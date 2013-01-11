importScripts('/lib/linkjs-ext/responder.js');
importScripts('/apps/util/lib/marked.js');

marked.setOptions({
    gfm: true,
    tables: true,
    breaks: false,
    pedantic: false,
    sanitize: false, //true,
    highlight: function(code, lang) {
        if (lang === 'js') {
            return code;//highlighter.javascript(code);
        }
        return code;
    }
});

app.onHttpRequest(function(request, response) {
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
			return (md) ? marked(md) : '';
		}
	);
});
app.postMessage('loaded');