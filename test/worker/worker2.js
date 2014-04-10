importScripts('../../local.js');
var counter = 100;
local.worker.setServer(function(req, res, page) {
	if (req.path == '/' && req.method == 'GET') {
		res.writeHead(200, 'ok', { 'content-type': 'text/plain' });
		res.end(counter--);
		return;
	}
	if (req.path == '/' && req.method == 'POST') {
		req.body_.then(function(body) {
			res.writeHead(200, 'ok', { 'content-type': 'text/plain' });
			res.end(body.toLowerCase());
		});
		return;
	}
	if (req.path == '/' && req.method == 'BOUNCE') {
		local.dispatch({ method: 'GET', url: 'local://0.page?foo=bob', query: { bar: 'buzz' } })
			.always(function(res2) {
				res.writeHead(200, 'ok', { 'content-type': 'text/plain' });
				res.end(res2.body);
			});
		return;
	}
	res.writeHead(404, 'not found').end();
});