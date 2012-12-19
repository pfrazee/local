app.onHttpRequest(function(request, response) {
	response.writeHead(200, 'ok', { 'content-type':'text/html' });
	response.end('<h1>Hello, World!</h1>');
});
app.postMessage('loaded');