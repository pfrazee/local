var log = [];
var listeners = [];

function renderHtml() {
	var html = [
		'<form action="httpl://request-stream.ui"><output>',
		log.map(function(entry) {
			return '<p>{method} {url} {type}</p>'
				.replace(/\{method\}/g, entry.method.toUpperCase())
				.replace(/\{url\}/g, entry.url || (entry.host + entry.path))
				.replace(/\{type\}/g, entry.headers.accept || '');
		}).reverse().join(''),
		'</output></form>'
	].join('');
	return html;
}

app.onHttpRequest(function(request, response) {
	if (request.method == 'get') {
		if (request.headers.accept == 'text/html') {
			// send back the html
			response.writeHead(200, 'ok', { 'content-type':'text/html' });
			response.end(renderHtml());
		}
		else if (request.headers.accept == 'text/event-stream') {
			// add the stream to our listeners
			response.writeHead(200, 'ok', { 'content-type':'text/html' });
			listeners.push(response);
		}
	} else if (request.method === 'post') {
		// store the data
		log.push(request.body);

		// success
		response.writeHead(200, 'ok');
		response.end();

		// notify of the update
		listeners.forEach(function(listener) {
			listener.write({ event:'update', data:{ values:{ log:true }}});
		});
	}
});
app.postMessage('loaded');
