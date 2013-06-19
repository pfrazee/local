var http = require('http');

// data that the resources represent
var serverData = {
	foos:['bar', 'baz', 'blah']
};
// for cors:
var commonReqHeaders = ['accept','content-type','vary'];

// create server
// =============
var server = http.createServer(function(request, response) {
	var payload = '';
	request.setEncoding('utf8'); // test server will only handle text streams
	request.on('data', function(chunk) {
		payload += chunk;
	});
	request.on('end', function() {
		if (/^\/?$/.test(request.url)) {
			serveHome(request, response);
		} else if (/^\/foo\/?$/.test(request.url)) {
			serveFoo(request, response);
		} else if (/^\/foo\/([A-z]*)\/?$/.test(request.url)) {
			serveFooItem(request, response);
		} else if (/^\/events\/?$/.test(request.url)) {
			serveEvents(request, response);
		} else {
			serveError(404, request, response);
		}
	});
});
server.listen(8080);
console.log('Now listening on port 8080');

// /
function serveHome(request, response) {
	var payload;

	// links
	var linkHeader = toLinkHeader([
		{ rel:'self current', href:'/' },
		{ rel:'collection', href:'/foo', id:'foo' },
		{ rel:'collection', href:'/{id}' }
	]);

	// method
	switch (request.method) {
		case 'OPTIONS':
		case 'HEAD':
			break;
		case 'GET':
			payload = { hello:'world' };
			break;
		default:
			return serveError(405, request, response);
	}

	// content type
	if (payload) {
		if (/text\/html/.test(request.headers['accept'])) {
			payload = "<h1>Hello, {hello}</h1>".replace('{hello}', payload.hello);
			response.setHeader('Content-type', 'text/html');
		} else {
			payload = JSON.stringify(payload);
			response.setHeader('Content-type', 'application/json');
		}
	}

	// send
	response.writeHead(200, 'Ok', {
		Allow:'OPTIONS, HEAD, GET',
		Link:linkHeader,
		'Access-Control-Allow-Origin'      : '*',
		'Access-Control-Allow-Credentials' : 'true',
		'Access-Control-Allow-Methods'     : 'OPTIONS, HEAD, GET',
		'Access-Control-Allow-Headers'     : Object.keys(request.headers).concat(commonReqHeaders).join(', '),
		'Access-Control-Expose-Headers'    : 'Allow, Link, Content-type'
	});
	response.end(payload);
}

// /foo
function serveFoo(request, response) {
	var payload;

	// links
	var linkHeader = toLinkHeader([
		{ rel:'up via service', href:'/' },
		{ rel:'self current', href:'/foo' },
		{ rel:'item', href:'/foo/{id}' }
	]);

	// method
	switch (request.method) {
		case 'OPTIONS':
		case 'HEAD':
			break;
		case 'GET':
			payload = serverData.foos;
			break;
		default:
			return serveError(405, request, response);
	}

	// content type
	if (payload) {
		if (/text\/html/.test(request.headers['accept'])) {
			payload = "<h1>Foos: {foos}</h1>".replace('{foos}', payload.join(', '));
			response.setHeader('Content-type', 'text/html');
		} else {
			payload = JSON.stringify(payload);
			response.setHeader('Content-type', 'application/json');
		}
	}

	// send
	response.writeHead(200, 'Ok', {
		Allow:'OPTIONS, HEAD, GET',
		Link:linkHeader,
		'Access-Control-Allow-Origin'      : '*',
		'Access-Control-Allow-Credentials' : 'true',
		'Access-Control-Allow-Methods'     : 'OPTIONS, HEAD, GET',
		'Access-Control-Allow-Headers'     : Object.keys(request.headers).concat(commonReqHeaders).join(', '),
		'Access-Control-Expose-Headers'    : 'Allow, Link, Content-type'
	});
	response.end(payload);
}

// /foo/{item}
function serveFooItem(request, response) {
	var payload;

	// parse out the item name
	var match = /^\/foo\/([A-z]*)\/?$/.exec(request.url);
	var itemName = match[1];
	var itemIndex = serverData.foos.indexOf(itemName);

	// validate
	if (itemIndex === -1) {
		return serveError(404, request, response);
	}

	// links
	var links = [
		{ rel:'via service', href:'/' },
		{ rel:'up collection index', href:'/foo' },
		{ rel:'self current', href:'/foo/'+itemName },
		{ rel:'first', href:'/foo/'+serverData.foos[0] },
		{ rel:'last', href:'/foo/'+serverData.foos[serverData.foos.length - 1] }
	];
	if (itemIndex !== 0) {
		links.push({ rel:'prev', href:'/foo/'+serverData.foos[itemIndex - 1] });
	}
	if (itemIndex !== serverData.foos.length - 1) {
		links.push({ rel:'next', href:'/foo/'+serverData.foos[itemIndex + 1] });
	}
	var linkHeader = toLinkHeader(links);

	// method
	switch (request.method) {
		case 'OPTIONS':
		case 'HEAD':
			break;
		case 'GET':
			payload = itemName;
			break;
		default:
			return serveError(405, request, response);
	}

	// content type
	if (payload) {
		if (/text\/html/.test(request.headers['accept'])) {
			payload = "<h1>{item}</h1>".replace('{item}', payload);
			response.setHeader('Content-type', 'text/html');
		} else {
			payload = JSON.stringify(payload);
			response.setHeader('Content-type', 'application/json');
		}
	}

	// send
	response.writeHead(200, 'Ok', {
		Allow:'OPTIONS, HEAD, GET',
		Link:linkHeader,
		'Access-Control-Allow-Origin'      : '*',
		'Access-Control-Allow-Credentials' : 'true',
		'Access-Control-Allow-Methods'     : 'OPTIONS, HEAD, GET',
		'Access-Control-Allow-Headers'     : Object.keys(request.headers).concat(commonReqHeaders).join(', '),
		'Access-Control-Expose-Headers'    : 'Allow, Link, Content-type'
	});
	response.end(payload);
}


// /events
function serveEvents(request, response) {
	// method
	switch (request.method) {
		case 'OPTIONS':
		case 'HEAD':
		case 'GET':
			break;
		default:
			return serveError(405, request, response);
	}

	// send headers
	response.writeHead(200, 'Ok', {
		Allow          : 'OPTIONS, HEAD, GET',
		'Content-type' : 'text/event-stream',
		'Access-Control-Allow-Origin'      : '*',
		'Access-Control-Allow-Credentials' : 'true',
		'Access-Control-Allow-Methods'     : 'OPTIONS, HEAD, GET',
		'Access-Control-Allow-Headers'     : Object.keys(request.headers).concat(commonReqHeaders).join(', '),
		'Access-Control-Expose-Headers'    : 'Allow, Link, Content-type'
	});

	response.write("event: foo\r\ndata:{ \"c\":1 }\r\n\r\n");
	response.write("event: foo\r\ndata:{ \"c\":2 }\r\n\r\n");
	response.write("event: bar\r\ndata:{ \"c\":3 }\r\n\r\n");
	response.write("event: foo\r\ndata:{ \"c\":4 }\r\n\r\n");
	response.end("event: foo\r\ndata:{ \"c\":5 }\r\n\r\n");
}

// helpers
// =======
function serveError(code, request, response) {
	response.writeHead(code, http.STATUS_CODES[code], {
		Allow:'OPTIONS, HEAD, GET',
		'Access-Control-Allow-Origin'      : '*',
		'Access-Control-Allow-Credentials' : 'true',
		'Access-Control-Allow-Methods'     : 'OPTIONS, HEAD, GET',
		'Access-Control-Allow-Headers'     : Object.keys(request.headers).concat(commonReqHeaders).join(', '),
		'Access-Control-Expose-Headers'    : 'Allow, Link, Content-type'
	});
	response.end();
}

function toLinkHeader(links) {
	var strLinks = links.map(function(link) {
		var arr = ['<'+link.href+'>'];
		for (var attr in link) {
			if (attr !== 'href') {
				arr.push(attr+'="'+link[attr]+'"');
			}
		}
		return arr.join('; ');
	});
	return strLinks.join(', ');
}