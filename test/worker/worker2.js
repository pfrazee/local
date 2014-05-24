if (!self.counter)
	self.counter = 100;

if ($req.GET) {
    $res.s200().ContentType('plain');
    $res.Link({ href: '#' });
	$res.end(self.counter--);
	return;
}
if ($req.POST) {
    $req.buffer(function() {
        $res.s200().ContentType('plain');
		$res.end($req.body.toLowerCase());
	});
	return;
}
if ($req.BOUNCE) {
    return GET('http://page#hello?foo=bob', { bar: 'buzz' }).pipe($res);
}
$res.s405().end();