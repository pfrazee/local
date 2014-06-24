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
        return web.get('#hello?foo=bob', { bar: 'buzz' }).pipe(res);
	}
    res.s405().end();
});

// web.export(main);

// var counter = 100;

// main.ContentType('text');
// main.link(main);
// function main() {
// 	return ''+counter--;
// }

// main.method(POST);
// POST.Accept('text');
// POST.ContentType('text');
// function POST(req) {
// 	return req.body.toLowerCase();
// }

// main.method(BOUNCE);
// function BOUNCE() {
// 	return web.GET('#hello?foo=bob', { bar: 'buzz' });
// }