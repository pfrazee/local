web.at('#', function(req, res) {
	res.link('#', { rel: "self service foo.com/bar", title: "Page Root" });
	if (req.method == 'POST') {
		req.buffer(function() {
			res.s200().text(req.body.toUpperCase()).end();
		});
	} else {
		res.s200().text('Iframe server').end();
	}
});