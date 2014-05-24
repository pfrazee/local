// worker local scaffold server
local.spawnWorker('/test/web/_worker.js');

// document local scaffold server
var foos = ['bar', 'baz', 'blah'];
local.at('#', function(req, res) {
	var payload = null, linkHeader;
	if (req.method === 'GET') {
		payload = 'service resource';
	}
    res.link({ rel:'self current http://grimwire.com/rel/test grimwire.com/rel/test grimwire.com', href:'#' });
    res.link(
        ['rel',       'href',    'id'],
		'collection', '#events', 'events',
        'collection', '#foo',    'foo',
		'collection', '#{id}',   undefined
    );
	res.s200().ContentType('plain').end(payload);
});

local.at('#foo', function(req, res) {
	var payload = null, linkHeader;
	if (req.method != 'HEAD') {
		payload = foos;
	}
	if (req.method == 'POST') {
		// pipe back
		return req.pipe(res.s200());
	}
	linkHeader = [
		{ rel:'up via service', href:'#' },
		{ rel:'self current', href:'#foo' },
		{ rel:'item', href:'#foo/{id}' }
	];
	res.s200().link(linkHeader);
	// so we can experiment with streaming, write the json in bits:
	if (payload) {
		res.json('[');
		payload.forEach(function(p, i) { res.json((i!==0?',':'')+'"'+p+'"'); });
		res.json(']');
	}
	res.end();
});

local.at('#foo/([A-z]*)', function(req, res) {
	var payload = null, linkHeader;
	var itemName = req.pathd[1];
	var itemIndex = foos.indexOf(itemName);
	if (itemIndex === -1) {
		return res.s404().end();
	}
	if (req.method === 'GET') {
		payload = itemName;
	}
    res.link('#', 'via service');
    res.link('#foo', 'up collection index');
    res.link('#foo/'+itemName, 'self current');
    res.link('#foo/'+foos[0], 'first');
    res.link('#foo/'+foos[foos.length - 1], 'last');
	if (itemIndex !== 0) {
        res.link('#foo/'+foos[itemIndex - 1], 'prev');
	}
	if (itemIndex !== foos.length - 1) {
		res.link('#foo/'+foos[itemIndex + 1], 'next');
	}
	res.s200().ContentType('json');
	res.end('"'+payload+'"');
});

local.at('#headers-echo', function(req, res) {
	res.s204()
		.header('content-type', req.ContentType)
		.header('fooBar', req.FooBar)
		.header('Asdf-fdsa', req.AsdfFdsa)
		.header('contentMD5', req.ContentMD5)
		.end();
});

local.at('#mimetype-alises-echo', function(req, res) {
	if (req.ContentType !== 'text/csv') {
		return res.s415('only understands text/csv').end();
	}
	if (!local.preferredType(req.Accept, 'html')) {
		return res.s406('can only provide html').end();
	}
	req.buffer(function() {
		res.s200().html('<strong>'+req.body+'</strong>').end();
	});
});

// pound-sign optional
local.at('pound-sign-optional', function(req, res) {
	res.s204().end();
});

// body parsing
local.at('#parse-body', function(req, res) {
	if (req.ContentType !== 'application/json' && req.ContentType != local.contentTypes.lookup('form')) {
		return res.s415('only understands json and form-urlencoded').end();
	}
	req.buffer(function() {
		res.s200().end(req.body);
	});
});

// query params
local.at('#query-params', function(req, res) {
	res.s200().json(req.params).end();
});

local.at('#events', function(req, res) {
	res.s200()
		.event('foo', { c: 1 })
		.event('foo', { c: 2 })
		.event('bar', { c: 3 });
	res.write('event: foo\r\n');
	setTimeout(function() { // break up the event to make sure the client waits for the whole thing
		res.write('data: { "c": 4 }\r\n\r\n');
		res.end({ event:'foo', data:{ c:5 }});
	}, 50);
});

local.at('#timeout', function(req, res) {
	setTimeout(function() {
		res.s204().end();
	}, 3000);
});

local.at('#pipe', function(req, res) {
	var headerUpdate = function(k, v) {
		if (k == 'ContentType') { return 'text/piped+plain'; }
		return v;
	};
	var bodyUpdate = function(body) {
		return (req.params.toLower) ? body.toLowerCase() : body.toUpperCase();
	};
	if (req.method == 'GET')
		GET(req.params.src).pipe(res, headerUpdate, bodyUpdate);
	else if (req.method == 'POST')
		req.pipe(res.s200(), headerUpdate, bodyUpdate);
});

// request links
local.at('#req-links', function(req, res) {
	res.s200().json(req.links.get('item')).end();
});