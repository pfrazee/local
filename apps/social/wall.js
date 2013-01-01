importScripts('/lib/linkjs-ext/responder.js');
importScripts('/lib/linkjs-ext/router.js');
importScripts('/lib/linkjs-ext/broadcaster.js');
importScripts('/lib/linkjs-ext/headers.js');

var dataProvider = Link.navigator(app.config.dataSource);

function renderFormHtml() {
	return [
	'<form>',
		'<label for="wall">Submit something for my wall: <img src="/assets/icons/16x16/help.png" title="Note: I review all posts before publishing" /></label>',
		'<textarea id="wall" name="wall" class="span6"></textarea><br/>',
		'<p>Submitting as: <span class="persona-ctrl"></span></p>',
		'<button type="submit" class="btn btn-block disabled">Submit</button>',
	'</form>'
	].join('');
}

function renderPostsHtml(posts) {
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

function renderHtml(posts) {
	var html = [
		renderFormHtml(),
		renderPostsHtml(posts)
	].join('');
	return html;
}

// request router
app.onHttpRequest(function(request, response) {
	var router = Link.router(request);
	var respond = Link.responder(response);

	// collection
	router.p('/', function() {
		// build headers
		var headers = Link.headers();
		headers.addLink('/', 'self current');

		// render all
		router.ma('GET', /html/, function() {
			// fetch posts
			dataProvider.get(
				{ headers:{ accept:'application/json'} },
				function(res) {
					res.on('end', function() {
						respond.ok('html', headers).end(renderHtml(res.body));
					});
				},
				function(err) {
					console.log('failed to retrieve posts', err.message);
					respond.badGateway().end();
				});
		});
		router.error(response, 'path');
	});
	router.error(response);
});
app.postMessage('loaded');
