// request latency logging
local.setDispatchWrapper(function(request, response, dispatch) {
	response.on('close', function() { console.log(response.latency+'ms'); });
	dispatch(request, response);
});


// worker local scaffold server
local.spawnWorkerServer('/test/web/_worker.js', { log: true });

// document local scaffold server

local.addServer('test.com', function(request, response) {
	var foos = ['bar', 'baz', 'blah'];
	var payload = null, linkHeader;
	if (request.path == '/') {
		if (request.method === 'GET') {
			payload = 'service resource';
		}
		linkHeader = [
			{ rel:'self current http://grimwire.com/rel/test grimwire.com/rel/test grimwire.com', href:'/' },
			{ rel:'collection', href:'/events', id:'events' },
			{ rel:'collection', href:'/foo', id:'foo' },
			{ rel:'collection', href:'/{id}' }
		];
		response.writeHead(200, 'ok', { 'content-type':'text/plain', 'link':linkHeader });
		response.end(payload);
	}
	else if (request.path == '/foo') {
		if (request.method != 'HEAD') {
			payload = foos;
		}
		if (request.method == 'POST') {
			return request.body_
				.then(function(body) {
					response.writeHead(200, 'ok', { 'Content-Type': request.headers['content-type'] });
					response.end(body);
				});
		}
		linkHeader = [
			{ rel:'up via service', href:'/' },
			{ rel:'self current', href:'/foo' },
			{ rel:'item', href:'/foo/{id}' }
		];
		response.writeHead(200, 'ok', { 'content-type':'application/json', 'link':linkHeader });
		// so we can experiment with streaming, write the json in bits:
		if (payload) {
			response.write('[');
			payload.forEach(function(p, i) { response.write((i!==0?',':'')+'"'+p+'"'); });
			response.write(']');
		}
		response.end();
	}
	else if (/^\/foo\/([A-z]*)$/.test(request.path)) {
		var match = /^\/foo\/([A-z]*)$/.exec(request.path);
		var itemName = match[1];
		var itemIndex = foos.indexOf(itemName);
		if (itemIndex === -1) {
			response.writeHead(404, 'not found');
			response.end();
			return;
		}
		if (request.method === 'GET') {
			payload = itemName;
		}
		linkHeader = [
			{ rel:'via service', href:'/' },
			{ rel:'up collection index', href:'/foo' },
			{ rel:'self current', href:'/foo/'+itemName },
			{ rel:'first', href:'/foo/'+foos[0] },
			{ rel:'last', href:'/foo/'+foos[foos.length - 1] }
		];
		if (itemIndex !== 0) {
			linkHeader.push({ rel:'prev', href:'/foo/'+foos[itemIndex - 1] });
		}
		if (itemIndex !== foos.length - 1) {
			linkHeader.push({ rel:'next', href:'/foo/'+foos[itemIndex + 1] });
		}
		response.writeHead(200, 'ok', { 'content-type':'application/json', 'link':linkHeader });
		response.end('"'+payload+'"');
	}
	else if (request.path == '/events') {
		response.writeHead(200, 'ok', { 'content-type':'text/event-stream' });
		response.write({ event:'foo', data:{ c:1 }});
		response.write({ event:'foo', data:{ c:2 }});
		response.write({ event:'bar', data:{ c:3 }});
		response.write('event: foo\r\n');
		setTimeout(function() { // break up the event to make sure the client waits for the whole thing
			response.write('data: { "c": 4 }\r\n\r\n');
			response.end({ event:'foo', data:{ c:5 }});
		}, 50);
	}
	else if (request.path == '/timeout') {
		setTimeout(function() {
			response.writeHead(204).end();
		}, 3000);
	}
	else if (request.path == '/pipe') {
		var headerUpdate = function(headers) {
			headers['content-type'] = 'text/piped+plain';
			return headers;
		};
		var bodyUpdate = function(body) {
			return body.toUpperCase();
		};
		local.pipe(response, local.dispatch({ method:'get', url:'local://test.com/' }), headerUpdate, bodyUpdate);
	}
	else {
		response.writeHead(404, 'not found');
		response.end();
	}
});

// proxy server
local.addServer('proxy', function(req, res) {
	if (req.path == '/') {
		res.header('Link', [{ href: '/', rel: 'self service', noproxy: true }, {href: 'local://test.com', rel:'service'}, { href: '/{uri}', rel: 'service', noproxy: true }]);
		res.header('Proxy-Tmpl', 'local://proxy/{uri}');
		res.writeHead(204, 'ok, no content').end();
		return;
	}

	// Proxy the request through
	var req2 = new local.Request({
		method: req.method,
		url: decodeURIComponent(req.path.slice(1)),
		query: local.util.deepClone(req.query),
		headers: local.util.deepClone(req.headers),
		stream: true
	});

	// Set req via
	req2.headers['Via'] = (req.parsedHeaders.via||[]).concat([{proto: {version:'1.0', name:'httpl'}, hostname: 'proxy'}]);

	var res2_ = local.dispatch(req2);
	res2_.always(function(res2) {
		// Reserialize Link so that it uses updated (absolute) uris
		res2.headers.link = local.httpHeaders.serialize('link', res2.parsedHeaders.link);

		// Set res via
		res2.headers['Via'] = (res2.parsedHeaders.via||[]).concat([{proto: {version:'1.0', name:'httpl'}, hostname: 'proxy'}]);
		res2.headers['Proxy-Tmpl'] = ((res2.header('Proxy-Tmpl')||'') + ' local://proxy/{uri}').trim();

		// Pipe back
		res.writeHead(res2.status, res2.reason, res2.headers);
		res2.on('data', function(chunk) { res.write(chunk); });
		res2.on('end', function() { res.end(); });
		res2.on('close', function() { res.close(); });
	});
	req.on('data', function(chunk) { req2.write(chunk); });
	req.on('end', function() { req2.end(); });
});