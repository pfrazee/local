var counter = 0;
web.at('#', function(req, res) {
	if (req.method == 'GET') {
        res.s200().contentType('text');
        res.link({ href: '#' });
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
        return web.get('#hello?foo=alice', { bar: 'bazz' }).pipe(res);
	}
    if (req.method == 'IMPORT') {
		try {
			importScripts('../../local.js');
            res.s500('lib error').end('Error: import was allowed');
		} catch(e) {
            res.s200().end(e.toString());
		}
		return;
	}
    if (req.method == 'USEWEB') {
        return web.get('https://grimwire.com?foo=bar#baz', { yes: 'no' }).pipe(res);
    }
    res.s405().end();
});

