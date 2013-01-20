importScripts('linkjs-ext/responder.js');
importScripts('linkjs-ext/router.js');
importScripts('linkjs-ext/broadcaster.js');

var wallBroadcast = Link.broadcaster();
var wallPostsBroadcast = Link.broadcaster();

var posts = [];
var dataProvider = Link.navigator(app.config.dataSource);

// :DEBUG: couchDb's event-stream support is slated for v1.3 -- use the _changes stream for now
// var dataUpdates = Link.subscribe(app.config.dataSource);
// dataUpdates.on('update', function(e) {
// 	// if our provider ever updates, we should redraw the posts
// 	wallPostsBroadcast.emit('update');
// });
Link.dispatch({ stream:true, method:'get', url:app.config.updatesSource, query:{ feed:'continuous', heartbeat:'30000' }})
	.then(function(res) {
		res.on('data', function(data) {
			// parse the changes data
			var updates = data.split("\n")
				.map(function(update) { try { return JSON.parse(update); } catch(e) { return null; }})
				.filter(function(update) { return !!update; });
			console.log('chunk', updates);
			// issue an update if we got something
			if (updates.length !== 0) {
				wallPostsBroadcast.emit('update');
			}
		});
	})
	.except(function(err) {
		console.log('unable to reach update source: '+err.message);
	});

var user = null;
var userUpdates = Link.subscribe(app.config.userSource);
userUpdates.on(['subscribe','login','logout'], function(e) {
	user = e.data;
	wallBroadcast.emit('update'); // let's redraw everything
});

function renderFormHtml(query) {
	return [
		'<label for="wall-content">Write on my wall: ',
			'<img src=assets/icons/16x16/help.png title="Posts are stored on the remote host and use Server-Sent Events to live-update. Try opening this page in two tabs and posting." />',
			'<textarea id="wall-content" name="content" class="span6">',(query.content) ? query.content : '','</textarea><br/>',
		'</label>',
		'<p>',
			'Submitting as: <span class="persona-ctrl"></span> ',
			'<img src=assets/icons/16x16/help.png title="This signin/out control is a page widget. Logging in emits an event which causes the wall program to enable the submit button." />',
		'</p>',
		'<button type="submit" class="btn btn-block ', (user) ? '' : 'disabled', '">Submit</button>',
		'<br/>'
	].join('');
}

function renderPostsHtml() {
	if (posts && Array.isArray(posts)) {
		return posts.map(function(post) {
			return [
			'<blockquote>',
				'<p>',post.content,'</p>',
				'<small>',post.author,'</small>',
			'</blockquote>'
			].join('');
		}).join('');
	} else {
		console.log('bad posts data',posts);
		return 'Internal Error :(';
	}
}

function renderHtml(query) {
	switch (query.output) {
		case 'posts':
			return renderPostsHtml();
		case 'all':
			return [
				renderFormHtml(query),
				'<output name="posts" form="wall-posts">',
					renderPostsHtml(),
				'</output>'
			].join('');
		default:
			return [
				'<form action="httpl://', app.config.domain,'" method="post" enctype="application/json">',
					'<output name="all">',
						renderFormHtml(query),
						'<output name="posts" form="wall-posts">',
							renderPostsHtml(),
						'</output>',
					'</output>',
				'</form>',
				'<form id="wall-posts" action="httpl://', app.config.domain,'/posts"></form>'
			].join('');
	}
}

function getPosts(cb) {
	dataProvider.getJson(null, { query:{ descending:'true', limit:15 }})
		.then(function(res) {
			posts = (res.body) ? res.body.rows : null;
			cb(null, res);
		})
		.except(function(err) {
			console.log('failed to retrieve posts', err.message);
			cb(err);
		});
}

// request router
app.onHttpRequest(function(request, response) {
	var router = Link.router(request);
	var respond = Link.responder(response);

	// service
	router.p('/', function() {
		// build headers
		var headerer = Link.headerer();
		headerer.addLink('/', 'self current service');
		headerer.addLink('/posts', 'collection', { title:'posts' });

		// render
		router.ma('GET', /html/, function() {
			// fetch posts
			getPosts(function(err, res) {
				if (err) { respond.badGateway().end(); }
				else { respond.ok('html', headerer).end(renderHtml(request.query)); }
			});
		});
		// event subscribe
		router.ma('GET', /event-stream/, function() {
			respond.ok('text/event-stream', headerer);
			wallBroadcast.addStream(response);
		});
		// post submit
		router.mta('POST', /json/, /html/, function() {
			if (!user) { return respond.unauthorized().end(); }
			// pass on to data-source
			dataProvider.post(request.body, 'application/x-www-form-urlencoded', { accept:'application/json' })
				.then(function(res) {
					// success
					respond.ok('text/html').end(renderHtml(request.query));
				})
				.except(function(err) { respond.pipe(err.response); });
		});
		router.error(response, 'path');
	});
	// posts service
	router.p(/^\/posts\/?$/, function() {
		// build headers
		var headerer = Link.headerer();
		headerer.addLink('/', 'up via service');
		headerer.addLink('/posts', 'self current collection');

		// render
		router.ma('GET', /html/, function() {
			// fetch posts
			getPosts(function(err, res) {
				if (err) { respond.badGateway().end(); }
				else { respond.ok('html', headerer).end(renderHtml(request.query)); }
			});
		});
		// event subscribe
		router.ma('GET', /event-stream/, function() {
			respond.ok('text/event-stream', headerer);
			wallPostsBroadcast.addStream(response);
		});
		router.error(response, 'path');
	});
	router.error(response);
});
app.postMessage('loaded');
