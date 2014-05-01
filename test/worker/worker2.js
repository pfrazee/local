importScripts('../../local.js');
var counter = 100;
local.at('#', function(req, res) {
	if (req.GET) {
        res.s200().ContentType('plain');
        res.Link({ href: '#' });
		res.end(counter--);
		return;
	}
	if (req.POST) {
        req.buffer(function() {
            res.s200().ContentType('plain');
			res.end(req.body.toLowerCase());
		});
		return;
	}
	if (req.BOUNCE) {
        return GET('#hello?foo=bob', { bar: 'buzz' }).pipe(res);
	}
    res.s405().end();
});