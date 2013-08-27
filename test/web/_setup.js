// worker local scaffold server

local.workerBootstrapUrl = '../worker.js';
local.spawnWorkerServer('test/web/_worker.js');

// document local scaffold server

local.web.registerLocal('test.com', function(request, response) {
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
			return request.finishStream()
				.then(function(body) {
					response.writeHead(200, 'ok', { 'content-type': request.headers['content-type'] });
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
	else if (request.path == '/pipe') {
		var headerUpdate = function(headers) {
			headers['content-type'] = 'text/piped+plain';
			return headers;
		};
		var bodyUpdate = function(body) {
			return body.toUpperCase();
		};
		local.web.pipe(response, local.web.dispatch({ method:'get', url:'httpl://test.com/' }), headerUpdate, bodyUpdate);
	}
	else {
		response.writeHead(404, 'not found');
		response.end();
	}
});