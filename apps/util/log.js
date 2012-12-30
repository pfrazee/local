importScripts('/lib/linkjs-ext/responder.js');
importScripts('/lib/linkjs-ext/router.js');
importScripts('/lib/linkjs-ext/broadcaster.js');

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

	router.rm('', 'get', function() {
		router.a('html', function() { respond.ok('html').end(renderHtml()); });
		router.a('events', function() { logBroadcast.addStream(respond.ok('events')); });
		router.error(response);
	});
	router.rmt('', 'post', /text\/[html|plain]/ig, function() {
		log.push(request.body); // store the entry
		logBroadcast.emit('update'); // tell our listeners
		respond.ok().end(); // respond 200
	});
	router.error(response);
});
app.postMessage('loaded');
