var log = [];
app.onHttpRequest(function(request, response) {
	if (request.method == 'get') {
		response.writeHead(200, 'ok', { 'content-type':'text/html' });
		response.end('<h1>todo</h1>');
	} else if (request.method === 'post') {
		// :TODO: validate
		log.push(request.payload);
		response.writeHead(200, 'ok');
		response.end();
	}
});
app.postMessage('loaded');
