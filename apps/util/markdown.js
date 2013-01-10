importScripts('/lib/linkjs-ext/responder.js');
importScripts('/apps/util/lib/markdown.js');
console.log(app.config);
app.onHttpRequest(function(request, response) {
	console.log(app.config.baseUrl + request.path);
	Link.responder(response).pipe(
		Link.request({
			method:'get',
			url:app.config.baseUrl + request.path,
			headers:{ accept:'text/plain' }
		}),
		function(headers) {
			headers['content-type'] = 'text/html';
			return headers;
		},
		function(md) {
			return (md) ? markdown.toHTML(md) : '';
		}
	);
});
app.postMessage('loaded');