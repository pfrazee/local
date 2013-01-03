importScripts('/lib/linkjs-ext/responder.js');
importScripts('/lib/linkjs-ext/router.js');
importScripts('/lib/linkjs-ext/broadcaster.js');

var wallBroadcast = Link.broadcaster();

var posts = [];
var dataProvider = Link.navigator(app.config.dataSource);

var user = null;
var userUpdates = Link.subscribe(app.config.userSource);
userUpdates.on(['subscribe','login','logout'], function(e) {
	user = e.data;
	wallBroadcast.emit('update'); // let's redraw
});

function renderFormHtml(query) {
	return [
		'<label for="wall-content">Submit something for my wall:',
		'<textarea id="wall-content" name="content" class="span6">',(query.content) ? query.content : '','</textarea><br/>',
		'<p>Submitting as: <span class="persona-ctrl"></span></p>',
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
	// render the content
	var html = [
		renderFormHtml(query),
		renderPostsHtml()
	].join('');

	if (!query.output) {
		// add the wrapper
		html = [
		'<form action="httpl://', app.config.domain,'" method="post" enctype="application/json">',
			'<output name="content">',
				html,
			'</output>',
		'</form>'
		].join('');
	}
	return html;
}

// request router
app.onHttpRequest(function(request, response) {
	var router = Link.router(request);
	var respond = Link.responder(response);

	// collection
	router.p('/', function() {
		// build headers
		var headerer = Link.headerer();
		headerer.addLink('/', 'self current');

		// render
		router.ma('GET', /html/, function() {
			// fetch posts
			dataProvider.get(
				{ headers:{ accept:'application/json'} },
				function(res) {
					res.on('end', function() {
						posts = res.body;
						respond.ok('html', headerer).end(renderHtml(request.query));
					});
				},
				function(err) {
					console.log('failed to retrieve posts', err.message);
					respond.badGateway().end();
				}
			);
		});
		// event subscribe
		router.ma('GET', /event-stream/, function() {
			respond.ok('text/event-stream', headerer);
			wallBroadcast.addStream(response);
		});
		// post submit
		router.mta('POST', /json/, /html/, function() {
			if (user) {
				// pass on to data-source
				dataProvider.post(
					{ body:request.body, headers:{ 'content-type':'application/json' }},
					function(res) {
						// success
						posts.unshift({ author:user, content:request.body.content });
						respond.ok('text/html').end(renderHtml(request.query));
					},
					function(err) {
						responder.pipe(err.response);
					}
				);
			} else {
				respond.unauthorized().end();
			}
		});
		router.error(response, 'path');
	});
	router.error(response);
});
app.postMessage('loaded');
