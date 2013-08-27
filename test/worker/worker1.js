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
	res.writeHead(404, 'not found').end();
}