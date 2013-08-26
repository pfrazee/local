function main(req, res, page) {
	res.writeHead(200, 'ok', {'content-type': 'application/json'});
	res.write({ page: page.id });
	res.end();
}