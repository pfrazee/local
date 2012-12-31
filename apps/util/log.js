importScripts('/lib/linkjs-ext/responder.js');
importScripts('/lib/linkjs-ext/router.js');
importScripts('/lib/linkjs-ext/broadcaster.js');
importScripts('/lib/linkjs-ext/headers.js');

var log = [];
var logBroadcast = Link.broadcaster();

function renderHtml() {
	var html = [
		'<h5>'+app.config.title+'</h5>',
		'<form action="httpl://'+app.config.domain+'"><output>',
		log.map(function(entry) { return '<p>'+entry+'</p>'; }).reverse().join(''),
		'</output></form>'
	].join('');
	return html;
}

app.onHttpRequest(function(request, response) {
	var router = Link.router(request);
	var respond = Link.responder(response);

	// collection
	router.p('/', function() {
		// build headers
		var headers = Link.headers();
		headers.addLink('/', 'self current');

		// list
		router.ma('GET', /html/, function() {
			respond.ok('html', headers).end(renderHtml()); // respond with log html
		});
		// subscribe to events
		router.ma('GET', /event-stream/, function() {
			respond.ok('event-stream', headers);
			logBroadcast.addStream(response); // add the log updates listener
		});
		// add log entry
		router.mt('POST', /html|plain/, function() {
			log.push(request.body); // store the entry
			logBroadcast.emit('update'); // tell our listeners about the change
			respond.ok().end();
		});
		router.error(response, 'path');
	});
	router.error(response);
});
app.postMessage('loaded');
