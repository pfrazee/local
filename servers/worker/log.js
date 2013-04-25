var log = [];
var logBroadcast = local.http.broadcaster();

function renderHtml(output) {
	var entriesHtml = log
		.map(function(entry) { return '<p>'+entry+'</p>'; })
		.reverse()
		.join('');
	if (output == 'entries') {
		return entriesHtml;
	}
	var html = [
		'<h5>'+local.worker.config.title+'</h5>',
		'<div data-subscribe="httpl://'+local.worker.config.domain+'?output=entries">',
			entriesHtml,
		'</div>'
	].join('');
	return html;
}

function main(request, response) {
	if (/head/i.test(request.method))
		response.writeHead(200, 'ok').end();
	// get interface
	else if (/get/i.test(request.method) && /html/.test(request.headers.accept)) {
		response // respond with log html
			.writeHead(200, 'ok', {'content-type':'text/html'})
			.end(renderHtml(request.query.output));
	// subscribe to events
	} else if (/get/i.test(request.method) && /event-stream/.test(request.headers.accept)) {
		response.writeHead(200, 'ok', {'content-type':'text/event-stream'});
		logBroadcast.addStream(response); // add the log updates listener
		logBroadcast.emitTo(response, 'update'); // resync for any changes that might've occured
	// add entry
	} else if (/post/i.test(request.method) && /text/.test(request.headers['content-type'])) {
		log.push(request.body); // store the entry
		logBroadcast.emit('update'); // tell our listeners about the change
		response.writeHead(204, 'no content').end();
	} else
		response.writeHead(405, 'bad method').end();
}
