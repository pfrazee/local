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
		return res.s200().ContentType(req.ContentType).pipe(req);
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
	res.pipe(GET('#').bufferResponse(false), headerUpdate, bodyUpdate);
});