importScripts('assets/marked.js');
marked.setOptions({ gfm: true, tables: true });

local.worker.setServer(function (request, response) {
	var url = local.worker.config.baseUrl + request.path;
	local.pipe(
		response,
		local.dispatch({ url: url, headers: { accept:'text/plain' }}),
		function (headers) {
			headers['content-type'] = 'text/html';
			return headers;
		},
		function (md) { return (md) ? marked(md) : ''; }
	);
});