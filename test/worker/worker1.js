if (!self.counter)
	self.counter = 0;

if ($req.GET) {
    $res.s200().ContentType('text');
    $res.Link({ href: '#' });
	$res.end(''+self.counter++);
	return;
}
if ($req.POST) {
    $req.buffer(function() {
        $res.s200().ContentType('text');
		$res.end($req.body.toUpperCase());
	});
	return;
}
if ($req.BOUNCE) {
    return GET('#hello?foo=alice', { bar: 'bazz' }).pipe($res);
}
if ($req.IMPORT) {
	try {
		importScripts('../../local.js');
        $res.s500('lib error').end('Error: import was allowed');
	} catch(e) {
        $res.s200().end(e.toString());
	}
	return;
}
if ($req.USEWEB) {
    return GET('https://layer1.io').pipe($res);
}
$res.s405().end();