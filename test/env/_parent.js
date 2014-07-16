web.createServer(document.getElementById('test-iframe'), mainServer).listen({ local: 'iframe' });
web.createServer(mainServer).listen({ local: 'main' });

function mainServer(req, res) {
	res.link('/', { rel: "self service foo.com/baz", title: "Parent Frame" });
	if (req.method == 'POST') {
		req.buffer(function() {
			res.s200().text(req.body.toLowerCase()).end();
		});
	} else {
		res.s200().text('Top Window').end();
	}
}