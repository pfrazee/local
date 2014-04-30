// worker local scaffold server
// local.spawnWorkerServer('/test/web/_worker.js', { log: true });

// document local scaffold server

var foos = ['bar', 'baz', 'blah'];
local.at('#', function(req, res) {
	var payload = null, linkHeader;
	if (req.method === 'GET') {
		payload = 'service resource';
	}
	linkHeader = [
		{ rel:'self current http://grimwire.com/rel/test grimwire.com/rel/test grimwire.com', href:'#' },
		{ rel:'collection', href:'#events', id:'events' },
		{ rel:'collection', href:'#foo', id:'foo' },
		{ rel:'collection', href:'#{id}' }
	];
	res.s200().ContentType('plain').Link(linkHeader).end(payload);
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
	res.s200().ContentType('json').Link(linkHeader);
	// so we can experiment with streaming, write the json in bits:
	if (payload) {
		res.write('[');
		payload.forEach(function(p, i) { res.write((i!==0?',':'')+'"'+p+'"'); });
		res.write(']');
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
	linkHeader = [
		{ rel:'via service', href:'#' },
		{ rel:'up collection index', href:'#foo' },
		{ rel:'self current', href:'#foo/'+itemName },
		{ rel:'first', href:'#foo/'+foos[0] },
		{ rel:'last', href:'#foo/'+foos[foos.length - 1] }
	];
	if (itemIndex !== 0) {
		linkHeader.push({ rel:'prev', href:'#foo/'+foos[itemIndex - 1] });
	}
	if (itemIndex !== foos.length - 1) {
		linkHeader.push({ rel:'next', href:'#foo/'+foos[itemIndex + 1] });
	}
	res.s200().ContentType('json').Link(linkHeader);
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
		res.s200().end('<strong>'+req.body+'</strong>');
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
	res.s200().ContentType('json').end(req.params);
});

local.at('#events', function(req, res) {
	res.s200().ContentType('event-stream');
	res.write({ event:'foo', data:{ c:1 }});
	res.write({ event:'foo', data:{ c:2 }});
	res.write({ event:'bar', data:{ c:3 }});
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
		return body.toUpperCase();
	};
	if (req.method == 'GET')
		GET(req.params.src).pipe(res, headerUpdate, bodyUpdate);
	else if (req.method == 'POST')
		req.pipe(res.s200(), headerUpdate, bodyUpdate);
});