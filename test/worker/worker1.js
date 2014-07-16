importScripts('/local.js');

var counter = 0;
web.createServer(self, function(req, res) {
	if (req.method == 'GET') {
        res.s200().contentType('text');
        res.link({ href: '/' });
		res.end(''+counter++);
		return;
	}
	if (req.method == 'POST') {
        req.buffer(function() {
            res.s200().contentType('text');
			res.end(req.body.toUpperCase());
		});
		return;
	}
    if (req.method == 'BOUNCE') {
        return web.get('local://parent/hello?foo=alice', { bar: 'bazz' }).pipe(res);
	}
    res.s405().end();
}).listen({ local: 'parent' });

