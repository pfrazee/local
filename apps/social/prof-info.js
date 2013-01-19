importScripts('linkjs-ext/responder.js');
importScripts('linkjs-ext/router.js');
importScripts('linkjs-ext/broadcaster.js');

var dataProvider = Link.navigator(app.config.dataSource);

function renderGroupHtml(group) {
	return [
		'<dt>',group.label,'</dt>',
		group.items.map(function(item) {
			return ['<dd>',item,'</dd>'].join('');
		}).join('')
	].join('');
}

function renderHtml(profile) {
	var html = [
		'<dl>',
			profile.info.map(renderGroupHtml).join(''),
		'</dl>'
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
		var headerer = Link.headerer();
		headerer.addLink('/', 'self current');

		// render all
		router.ma('GET', /html/, function() {
			// fetch data
			dataProvider.getJson()
				.then(function(res) {
					res.on('end', function() {
						respond.ok('html', headerer).end(renderHtml(res.body));
					});
				})
				.except(function(err) {
					console.log('failed to retrieve posts', err.message);
					respond.badGateway().end();
				});
		});
		router.error(response, 'path');
	});
	router.error(response);
});
app.postMessage('loaded');
