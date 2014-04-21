importScripts('../../local.js');
var counter = 0;
local.worker.setServer(function(req, res, page) {
	if (req.path == '/' && req.method == 'GET') {
		res.writeHead(200, 'ok', { 'content-type': 'text/plain' });
		res.end(''+counter++);
		return;
	}
	if (req.path == '/' && req.method == 'POST') {
		req.body_.then(function(body) {
			res.writeHead(200, 'ok', { 'content-type': 'text/plain' });
			res.end(body.toUpperCase());
		});
		return;
	}
	if (req.path == '/' && req.method == 'BOUNCE') {
		local.dispatch({ method: 'GET', url: 'local://host.env?foo='+local.worker.config.myname, query: { bar: 'bazz' } })
			.always(function(res2) {
				res.writeHead(200, 'ok', { 'content-type': 'text/plain' });
				res.end(res2.body);
			});
		return;
	}
	if (req.path == '/' && req.method == 'IMPORT') {
		try {
			importScripts('../../local.js');
			res.writeHead(500, 'Lib Error').end('Error: import was allowed');
		} catch(e) {
			res.writeHead(200, 'OK').end(e.toString());
		}
		return;
	}
	res.writeHead(404, 'not found').end();
});