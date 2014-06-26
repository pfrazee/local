importScripts('/local.js');
web.at('#parent', self);

var foos = ['bar', 'bazzzz', 'blah'];

web.at('#', function(req, res) {
	var payload = null, linkHeader;
	if (req.method === 'GET') {
		payload = 'service resource';
	}
	if (Object.keys(req.params).length > 0) {
		payload += ' '+JSON.stringify(req.params);
	}
	linkHeader = [
		{ rel:'self current', href:'#' },
		{ rel:'collection', href:'#events', id:'events' },
		{ rel:'collection', href:'#foo', id:'foo' },
		{ rel:'collection', href:'#{id}' }
	];
	res.s200().contentType('plain').link(linkHeader).end(payload);
});

web.at('#foo', function(req, res) {
	linkHeader = [
		{ rel:'up via service', href:'#' },
		{ rel:'self current', href:'#foo' },
		{ rel:'item', href:'#foo/{id}' }
	];
	if (req.method == 'POST') {
		// Echo back
		res.link(linkHeader);
		return req.pipe(res.s200());
	}
	var payload = null, linkHeader;
	if (req.method === 'GET') {
		payload = foos;
	}
	res.s200().contentType('json').link(linkHeader);
	// so we can experiment with streaming, write the json in bits:
	if (payload) {
		res.write('[');
		payload.forEach(function(p, i) { res.write((i!==0?',':'')+'"'+p+'"'); });
		res.write(']');
	}
	res.end();
});

web.at('#foo/([A-z]*)$', function(req, res) {
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
	res.s200().contentType('json').link(linkHeader);
	res.end('"'+payload+'"');
});

web.at('#events', function(req, res) {
	res.s200().contentType('event-stream');
	res.write({ event:'foo', data:{ c:1 }});
	res.write({ event:'foo', data:{ c:2 }});
	res.write({ event:'bar', data:{ c:3 }});
	res.write('event: foo\r\n');
	setTimeout(function() { // break up the event to make sure the client waits for the whole thing
		res.write('data: { "c": 4 }\r\n\r\n');
		res.end({ event:'foo', data:{ c:5 }});
	}, 50);
});

web.at('#pipe', function(req, res) {
	var headerUpdate = function(k, v) {
		if (k == 'ContentType') { return 'text/piped+plain'; }
		return v;
	};
	var bodyUpdate = function(body) {
		return body.toUpperCase();
	};
	res.pipe(web.get('#'), headerUpdate, bodyUpdate);
});