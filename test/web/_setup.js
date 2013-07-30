
// test runner helpers

var done;
var startTime;
function printSuccess(res) {
	print('success');
	print(res);
	return res;
}
function printError(res) {
	print('error');
	print(res);
	throw res;
}
function finishTest() {
	console.log(Date.now() - startTime, 'ms');
	done = true;
}
function printSuccessAndFinish(res) { printSuccess(res); finishTest(); }
function printErrorAndFinish(err) { printError(err); finishTest(); }

// local scaffold server

local.web.registerLocal('test.com', function(request, response) {
	var foos = ['bar', 'baz', 'blah'];
	var payload = null, linkHeader;
	if (request.path == '/') {
		if (request.method === 'GET') {
			payload = 'service resource';
		}
		linkHeader = [
			{ rel:'self current', href:'/' },
			{ rel:'collection', href:'/events', id:'events' },
			{ rel:'collection', href:'/foo', id:'foo' },
			{ rel:'collection', href:'/{id}' }
		];
		response.writeHead(200, 'ok', { 'content-type':'text/plain', 'link':linkHeader });
		response.end(payload);
	}
	else if (request.path == '/foo') {
		if (request.method === 'GET') {
			payload = foos;
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
		response.write({ event:'foo', data:{ c:4 }});
		response.end({ event:'foo', data:{ c:5 }});
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
	else if (request.path == '/proxy') {
		var proxyRequest = new local.web.Request(request);
		proxyRequest.method = request.headers['proxy-method'];
		proxyRequest.url = request.headers['proxy-to'];
		local.web.pipe(response, local.web.dispatch(proxyRequest), function(headers) {
			headers.via = ['httpl://test.com'];
			return headers;
		});
		proxyRequest.end();
	}
	else {
		response.writeHead(404, 'not found');
		response.end();
	}
});