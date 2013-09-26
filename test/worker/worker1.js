var counter = 0;
function main(req, res, page) {
	if (req.path == '/' && req.method == 'GET') {
		res.writeHead(200, 'ok', { 'content-type': 'text/plain' });
		res.end(counter++);
		return;
	}
	if (req.path == '/' && req.method == 'POST') {
		req.finishStream().then(function(body) {
			res.writeHead(200, 'ok', { 'content-type': 'text/plain' });
			res.end(body.toUpperCase());
		});
		return;
	}
	if (req.path == '/' && req.method == 'BOUNCE') {
		local.dispatch({ method: 'GET', url: 'httpl://0.page?foo='+local.worker.config.myname, query: { bar: 'bazz' } })
			.always(function(res2) {
				res.writeHead(200, 'ok', { 'content-type': 'text/plain' });
				res.end(res2.body);
			});
		return;
	}
	res.writeHead(404, 'not found').end();
}