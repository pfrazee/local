local.patchXHR();

local.addServer('localserver', function(request, response) {
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
	else {
		response.writeHead(404, 'not found');
		response.end();
	}
});