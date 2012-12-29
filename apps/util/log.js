importScripts('/lib/linkjs-ext/responder.js');

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
	var respond = Link.responder(response);
	if (request.method == 'get') {
		if (request.headers.accept == 'text/html') {
			respond.ok('html').end(renderHtml());
		}
		else if (request.headers.accept == 'text/event-stream') {
			// add the stream to our listeners
			respond.ok('events');
			listeners.push(response);
		}
	} else if (request.method === 'post') {
		// store the data
		log.push(request.body);

		// success
		respond.ok().end();

		// notify of the update
		listeners.forEach(function(listener) {
			listener.write({ event:'update', data:{ values:{ log:true }}});
		});
	}
});
app.postMessage('loaded');
