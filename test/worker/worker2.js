importScripts('/local.js');
web.at('#parent', self);

var counter = 100;
web.at('#', function(req, res) {
	if (req.method == 'GET') {
        res.s200().contentType('plain');
        res.link({ href: '#' });
		res.end(counter--);
		return;
	}
	if (req.method == 'POST') {
        req.buffer(function() {
            res.s200().contentType('plain');
			res.end(req.body.toLowerCase());
		});
		return;
	}
	if (req.method == 'BOUNCE') {
        return web.get('#parent/hello?foo=bob', { bar: 'buzz' }).pipe(res);
	}
    res.s405().end();
});

