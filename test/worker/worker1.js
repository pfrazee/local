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

// web.export(main);

// var counter = 0;

// main.ContentType('text');
// main.link(main);
// function main() {
// 	return ''+counter++;
// }

// main.method(POST);
// POST.Accept('text');
// POST.ContentType('text');
// function POST(req) {
// 	return req.body.toUpperCase();
// }

// main.method(BOUNCE);
// function BOUNCE() {
// 	return web.GET('#hello?foo=alice', { bar: 'bazz' });
// }

// main.method(IMPORT);
// IMPORT.ContentType('text');
// function IMPORT() {
// 	try {
// 		importScripts('../../local.js');
// 		throw 'Error: import was allowed';
// 	} catch (e) {
// 		return e.toString();
// 	}
// }

// main.method(USEWEB);
// function USEWEB() {
//     return web.GET('https://layer1.io?foo=bar#baz', { yes: 'no' });
// }