importScripts('/lib/linkjs-ext/responder.js');
importScripts('/lib/linkjs-ext/router.js');

var log = [];
var listeners = [];

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
		router.a('events', function() {
			respond.ok('events');
			// add the stream to our listeners
			listeners.push(response);
		});
		router.error(response);
	});
	router.rmt('', 'post', /text\/[html|plain]/ig, function() {
		// store the data
		log.push(request.body);
		respond.ok().end();

		// notify of the update
		listeners.forEach(function(listener) {
			listener.write({ event:'update', data:{ values:{ log:true }}});
		});
	});
	router.error(response);
});
app.postMessage('loaded');
