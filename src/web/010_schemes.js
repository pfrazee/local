// schemes
// =======
// EXPORTED
// dispatch() handlers, matched to the scheme in the request URIs
var schemes = {
	register: schemes__register,
	unregister: schemes__unregister,
	get: schemes__get
};
var schemes__registry = {};
local.schemes = schemes;

function schemes__register(scheme, handler) {
	if (scheme && Array.isArray(scheme)) {
		for (var i=0, ii=scheme.length; i < ii; i++)
			schemes__register(scheme[i], handler);
	} else
		schemes__registry[scheme] = handler;
}

function schemes__unregister(scheme) {
	delete schemes__registry[scheme];
}

function schemes__get(scheme) {
	return schemes__registry[scheme];
}


// HTTP
// ====
local.schemes.register(['http', 'https'], function(request, response) {
	// parse URL
	var urld = local.parseUri(request.url);

	// if a query was given in the options, mix it into the urld
	if (request.query) {
		var q = local.contentTypes.serialize('application/x-www-form-urlencoded', request.query);
		if (q) {
			if (urld.query) {
				urld.query    += '&' + q;
				urld.relative += '&' + q;
			} else {
				urld.query     =  q;
				urld.relative += '?' + q;
			}
		}
	}

	// assemble the final url
	var url = ((urld.protocol) ? (urld.protocol + '://') : '//') + urld.authority + urld.relative;

	// create the request
	var xhrRequest = new XMLHttpRequest();
	xhrRequest.open(request.method, url, true);
	if (request.binary) {
		xhrRequest.responseType = 'arraybuffer';
		if (request.stream)
			console.warn('Got HTTP/S request with binary=true and stream=true - sorry, not supported, binary responses must be buffered (its a browser thing)', request);
	}

	// set headers
	request.serializeHeaders();
	for (var k in request.headers) {
		if (request.headers[k] !== null && request.headers.hasOwnProperty(k))
			xhrRequest.setRequestHeader(k, request.headers[k]);
	}

	// buffer the body, send on end
	var body = '';
	request.on('data', function(data) { body += data; });
	request.on('end', function() { xhrRequest.send(body); });

	// abort on request close
	request.on('close', function() {
		if (xhrRequest.readyState !== XMLHttpRequest.DONE) {
			xhrRequest.aborted = true;
			xhrRequest.abort();
		}
	});

	// register response handlers
	var streamPoller=0, lenOnLastPoll=0, headersSent = false;
	xhrRequest.onreadystatechange = function() {
		if (xhrRequest.readyState >= XMLHttpRequest.HEADERS_RECEIVED && !headersSent) {
			headersSent = true;

			// extract headers
			var headers = {};
			if (xhrRequest.status !== 0) {
				if (xhrRequest.getAllResponseHeaders()) {
					xhrRequest.getAllResponseHeaders().split("\n").forEach(function(h) {
						if (!h) { return; }
						var kv = h.replace('\r','').split(': ');
						headers[kv[0].toLowerCase()] = kv.slice(1).join(': ');
					});
				} else {
					// a bug in firefox causes getAllResponseHeaders to return an empty string on CORS
					// (not ideal, but) iterate the likely headers
					var extractHeader = function(k) {
						var v = xhrRequest.getResponseHeader(k);
						if (v)
							headers[k.toLowerCase()] = v.toLowerCase();
					};
					extractHeader('Accept-Ranges');
					extractHeader('Age');
					extractHeader('Allow');
					extractHeader('Cache-Control');
					extractHeader('Connection');
					extractHeader('Content-Encoding');
					extractHeader('Content-Language');
					extractHeader('Content-Length');
					extractHeader('Content-Location');
					extractHeader('Content-MD5');
					extractHeader('Content-Disposition');
					extractHeader('Content-Range');
					extractHeader('Content-Type');
					extractHeader('Date');
					extractHeader('ETag');
					extractHeader('Expires');
					extractHeader('Last-Modified');
					extractHeader('Link');
					extractHeader('Location');
					extractHeader('Pragma');
					extractHeader('Refresh');
					extractHeader('Retry-After');
					extractHeader('Server');
					extractHeader('Set-Cookie');
					extractHeader('Trailer');
					extractHeader('Transfer-Encoding');
					extractHeader('Vary');
					extractHeader('Via');
					extractHeader('Warning');
					extractHeader('WWW-Authenticate');
				}
			}

			response.writeHead(xhrRequest.status, xhrRequest.statusText, headers);

			// start polling for updates
			if (!response.binary) {
				// ^ browsers buffer binary responses, so dont bother streaming
				streamPoller = setInterval(function() {
					// new data?
					var len = xhrRequest.response.length;
					if (len > lenOnLastPoll) {
						var chunk = xhrRequest.response.slice(lenOnLastPoll);
						lenOnLastPoll = len;
						response.write(chunk);
					}
				}, 50);
			}
		}
		if (xhrRequest.readyState === XMLHttpRequest.DONE) {
			if (streamPoller)
				clearInterval(streamPoller);
			if (response.status !== 0 && xhrRequest.status === 0 && !xhrRequest.aborted) {
				// a sudden switch to 0 (after getting a non-0) probably means a timeout
				console.debug('XHR looks like it timed out; treating it as a premature close'); // just in case things get weird
				response.close();
			} else {
				if (xhrRequest.response)
					response.write(xhrRequest.response.slice(lenOnLastPoll));
				response.end();
			}
		}
	};
});


// HTTPL
// =====
var localNotFoundServer = {
	fn: function(request, response) {
		response.writeHead(404, 'server not found');
		response.end();
	},
	context: null
};
var localRelayNotOnlineServer = {
	fn: function(request, response) {
		response.writeHead(407, 'peer relay not authenticated');
		response.end();
	},
	context: null
};
local.schemes.register('httpl', function(request, response) {
	// Find the local server
	var server = local.getServer(request.urld.authority);
	if (!server) {
		// Check if this is a peerweb URI
		var peerd = local.parsePeerDomain(request.urld.authority);
		if (peerd) {
			// See if this is a default stream miss
			if (peerd.sid == 0) {
				if (request.urld.authority.slice(-2) == '!0') {
					server = local.getServer(request.urld.authority.slice(0,-2));
				} else {
					request.urld.authority += '!0';
					server = local.getServer(request.urld.authority);
				}
			}
			if (!server) {
				// Not a default stream miss
				if (peerd.relay in __peer_relay_registry) {
					// Try connecting to the peer
					__peer_relay_registry[peerd.relay].connect(request.urld.authority);
					server = local.getServer(request.urld.authority);
				} else {
					// We're not connected to the relay
					server = localRelayNotOnlineServer;
				}
			}
		} else
			server = localNotFoundServer;
	}

	// Deserialize the headers
	request.deserializeHeaders();

	// Pull out and standardize the path & host
	request.path = request.urld.path;
	request.host = request.urld.authority;
	if (!request.path) request.path = '/'; // no path, give a '/'
	else request.path = request.path.replace(/(.)\/$/, '$1'); // otherwise, never end with a '/'

	// Pull out any query params in the path
	if (request.urld.query) {
		var query = local.contentTypes.deserialize('application/x-www-form-urlencoded', request.urld.query);
		if (!request.query) { request.query = {}; }
		for (var k in query) {
			request.query[k] = query[k];
		}
	}

	// Support warnings
	if (request.binary)
		console.warn('Got HTTPL request with binary=true - sorry, not currently supported', request);

	// Pass on to the server
	server.fn.call(server.context, request, response);
});


// Data
// ====
local.schemes.register('data', function(request, response) {
	var firstColonIndex = request.url.indexOf(':');
	var firstCommaIndex = request.url.indexOf(',');

	// parse parameters
	var param;
	var params = request.url.slice(firstColonIndex+1, firstCommaIndex).split(';');
	var contentType = params.shift();
	var isBase64 = false;
	while ((param = params.shift())) {
		if (param == 'base64')
			isBase64 = true;
	}

	// parse data
	var data = request.url.slice(firstCommaIndex+1);
	if (!data) data = '';
	if (isBase64) data = atob(data);
	else data = decodeURIComponent(data);

	// respond (async)
	local.util.nextTick(function() {
		response.writeHead(200, 'ok', {'content-type': contentType});
		response.end(data);
	});
});


// Local Server Registry
// =====================
var __httpl_registry = {};
var __peer_relay_registry = {}; // populated by PeerWebRelay startListening() and stopListening()

// EXPORTED
local.addServer = function addServer(domain, server, serverContext) {
	if (__httpl_registry[domain]) throw new Error("server already registered at domain given to addServer");

	var isServerObj = (server instanceof local.Server);
	if (isServerObj) {
		serverContext = server;
		server = server.handleLocalRequest;
		serverContext.config.domain = domain;
	}

	__httpl_registry[domain] = { fn: server, context: serverContext };
};

// EXPORTED
local.removeServer = function removeServer(domain) {
	if (__httpl_registry[domain]) {
		delete __httpl_registry[domain];
	}
};

// EXPORTED
local.getServer = function getServer(domain) {
	return __httpl_registry[domain];
};

// EXPORTED
local.getServers = function getServers() {
	return __httpl_registry;
};
