importScripts('linkjs-ext/responder.js');
importScripts('vendor/marked.js');

marked.setOptions({ gfm: true, tables: true });
function headerRewrite(headers) {
	headers['content-type'] = 'text/html';
	return headers;
}
function bodyRewrite(md) { return (md) ? marked(md) : ''; }

app.onHttpRequest(function(request, response) {
	var mdRequest = Link.dispatch({
		method  : 'get',
		url     : app.config.baseUrl + request.path,
		headers : { accept:'text/plain' }
	});
	Link.responder(response).pipe(mdRequest, headerRewrite, bodyRewrite);
});
app.postMessage('loaded');