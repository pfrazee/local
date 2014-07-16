// worker scaffold server
var worker = new Worker('/test/web/_worker.js');
web.createServer(worker, function(req, res) {
	// :TODO:
	res.s503().end();
}).listen({ local: 'worker' });

// document web scaffold server
var foos = ['bar', 'baz', 'blah'];
web.createServer(function(req, res) {
	var payload = null, linkHeader;
	if (req.path == '/') {
		if (req.method === 'GET') {
			payload = 'service resource';
		}
		res.link({ rel: 'self current http://grimwire.com/rel/test grimwire.com/rel/test grimwire.com', href:'/' });
		res.link({ rel: 'collection', href: 'local://events', id: 'events' });
		res.link({ rel: 'collection', href: '/foo', id: 'foo' });
		res.link({ rel: 'collection', href: '/{id}' });
		return res.s200().contentType('plain').end(payload);
	}

	if (req.path == '/foo') {
		if (req.method != 'HEAD') {
			payload = foos;
		}
		if (req.method == 'POST') {
			// pipe back
			return req.pipe(res.s200());
		}
		linkHeader = [
			{ rel:'up via service', href:'/' },
			{ rel:'self current', href:'/foo' },
			{ rel:'item', href:'/foo/{id}' }
		];
		res.s200().link(linkHeader);
		// so we can experiment with streaming, write the json in bits:
		if (payload) {
			res.json('[');
			payload.forEach(function(p, i) { res.json((i!==0?',':'')+'"'+p+'"'); });
			res.json(']');
		}
		return res.end();
	}

	if (req.path.indexOf('/foo/') === 0) {
		var itemName = req.path.slice(5);
		var itemIndex = foos.indexOf(itemName);
		if (itemIndex === -1) {
			return res.s404().end();
		}
		if (req.method === 'GET') {
			payload = itemName;
		}
		res.link('/', { rel: 'via service' });
		res.link('/foo', { rel: 'up collection index' });
		res.link('/foo/'+itemName, { rel: 'self current' });
		res.link('/foo/'+foos[0], { rel: 'first' });
		res.link('/foo/'+foos[foos.length - 1], { rel: 'last' });
		if (itemIndex !== 0) {
			res.link('/foo/'+foos[itemIndex - 1], { rel: 'prev' });
		}
		if (itemIndex !== foos.length - 1) {
			res.link('/foo/'+foos[itemIndex + 1], { rel: 'next' });
		}
		res.s200().contentType('json');
		res.end('"'+payload+'"');
	}

	res.s404().end();
}).listen({ local: 'main' });

web.createServer(function(req, res) {
	res.s204()
		.header('content-type', req.ContentType)
		.header('fooBar', req.FooBar)
		.header('Asdf-fdsa', req.AsdfFdsa)
		.header('contentMD5', req.ContentMD5)
		.end();
}).listen({ local: 'headers-echo' });

web.createServer(function(req, res) {
	if (req.ContentType !== 'text/csv') {
		return res.s415('only understands text/csv').end();
	}
	if (!web.preferredType(req.Accept, 'html')) {
		return res.s406('can only provide html').end();
	}
	req.buffer(function() {
		res.s200().html('<strong>'+req.body+'</strong>').end();
	});
}).listen({ local: 'mimetype-aliases-echo' });

web.createServer(function(req, res) {
	if (web.preferredType(req.Accept, 'json')) {
		return res.s200().json({ hello: 'yo' }).end();
	}
	return res.s200().text('hello yo').end();
}).listen({ local: 'accept-type' });

// body parsing
web.createServer(function(req, res) {
	if (req.ContentType !== 'application/json' && req.ContentType != web.contentTypes.lookup('form')) {
		return res.s415('only understands json and form-urlencoded').end();
	}
	req.buffer(function() {
		res.s200().end(req.body);
	});
}).listen({ local: 'parse-body' });

// query params
web.createServer(function(req, res) {
	res.s200().json(req.params).end();
}).listen({ local: 'query-params' });

web.createServer(function(req, res) {
	res.s200()
		.event('foo', { c: 1 })
		.event('foo', { c: 2 })
		.event('bar', { c: 3 });
	res.write('event: foo\r\n');
	setTimeout(function() { // break up the event to make sure the client waits for the whole thing
		res.write('data: { "c": 4 }\r\n\r\n');
		res.end({ event:'foo', data:{ c:5 }});
	}, 50);
}).listen({ local: 'events' });

web.createServer(function(req, res) {
	setTimeout(function() {
		res.s204().end();
	}, 3000);
}).listen({ local: 'timeout' });

web.createServer(function(req, res) {
	var headerUpdate = function(k, v) {
		if (k == 'ContentType') { return 'text/piped+plain'; }
		return v;
	};
	var bodyUpdate = function(body) {
		return (req.params.toLower) ? body.toLowerCase() : body.toUpperCase();
	};
	if (req.method == 'GET')
		web.get(req.params.src).pipe(res, headerUpdate, bodyUpdate);
	else if (req.method == 'POST')
		req.pipe(res.s200(), headerUpdate, bodyUpdate);
}).listen({ local: 'pipe' });

// request links
web.createServer(function(req, res) {
	res.s200().json(req.links.get('item')).end();
}).listen({ local: 'req-links' });