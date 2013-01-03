importScripts('/lib/linkjs-ext/responder.js');
importScripts('/lib/linkjs-ext/router.js');
importScripts('/lib/linkjs-ext/broadcaster.js');

var dataProvider = Link.navigator(app.config.dataSource);

function renderPictureHtml(profile) {
	return [
	'<img src="',profile.picture,'" class="img-polaroid" /><br/><br/>'
	].join('');
}

function renderAddressesHtml(profile) {
	if (profile.addresses && Array.isArray(profile.addresses)) {
		return [
		'<address class="well">',
			profile.addresses.map(function(address) { return [
				'<img src="/assets/icons/16x16/',address.icon,'.png" /> ',
				'<a href="',address.protocol,':',address.href,'" title="',address.label,'">',address.href,'</a><br/>'
			].join(''); }).join(''),
		'</address>'
		].join('');
	} else {
		console.log('bad addresses data',profile);
		return 'Internal Error :(';
	}
}

function renderHtml(profile) {
	var html = [
		renderPictureHtml(profile),
		renderAddressesHtml(profile)
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
			// fetch posts
			dataProvider.get(
				{ headers:{ accept:'application/json'} },
				function(res) {
					res.on('end', function() {
						respond.ok('html', headerer).end(renderHtml(res.body));
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
