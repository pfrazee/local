var util = require('../util');
var helpers = require('./helpers.js');
var contentTypes = require('./content-types.js');
var httpHeaders = require('./http-headers.js');
var Response = require('./response.js');

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
module.exports = schemes;

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
var inWorker = (typeof self != 'undefined' && typeof self.window == 'undefined');
schemes.register(['http', 'https'], function(oreq, ires) {
	var ores = new Response();
	ores.wireUp(ires);

	// No XHR in workers
	if (inWorker) {
		ores.status(0, 'public web requests are not allowed from workers');
		ores.end();
		return;
	}

	// parse URL
	var urld = helpers.parseUri(oreq.headers.url);

	// if query params were given in the headers, mix it into the urld
	if (Object.keys(oreq.headers.params).length) {
		var q = contentTypes.serialize('application/x-www-form-urlencoded', oreq.headers.params);
		if (q) {
			if (urld.query) { urld.query += '&' + q; }
			else            { urld.query = q; }
			urld.relative = urld.path + '?' + urld.query + ((urld.anchor) ? '#'+urld.anchor : '');
		}
	}

	// assemble the final url
	var url = ((urld.protocol) ? (urld.protocol + '://') : '//') + urld.authority + urld.relative;

	// create the xhr
	var xhrRequest = new XMLHttpRequest();
	xhrRequest.open(oreq.headers.method, url, true);
	if (oreq.isBinary) {
		xhrRequest.responseType = 'arraybuffer';
		if (oreq.stream)
			console.warn('Got HTTP/S request with isBinary=true and stream=true - sorry, not supported, binary responses must be buffered (its a browser thing)', request);
	}

	// set headers
	var headers = extractOreqHeaders(oreq.headers);
	for (var k in headers) {
		if (headers[k] !== null)
			xhrRequest.setRequestHeader(k, httpHeaders.serialize(k, headers[k]));
	}

	// buffer the body, send on end
	var body = '';
	oreq.on('data', function(data) {
		if (data && typeof data == 'object' && oreq.headers.ContentType) {
			data = contentTypes.serialize(oreq.headers.ContentType, data);
		}
		if (typeof data == 'string') { body += data; }
		else { body = data; } // assume it is an array buffer or some such
	});
	oreq.on('end', function() { xhrRequest.send(body); });

	// abort on oreq close
	oreq.on('close', function() {
		if (xhrRequest.readyState !== XMLHttpRequest.DONE) {
			xhrRequest.aborted = true;
			xhrRequest.abort();
		}
        ores.close();
	});

	// register res handlers
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
						ores.header(kv[0], kv.slice(1).join(': '));
					});
				} else {
					// a bug in firefox causes getAllResponseHeaders to return an empty string on CORS
					// (not ideal, but) iterate the likely headers
					var extractHeader = function(k) {
						var v = xhrRequest.getResponseHeader(k);
						if (v) ores.header(k, v);
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

			// send headers
			ores.status(xhrRequest.status, xhrRequest.statusText);
			ores.start();

			// start polling for updates
			if (!oreq.isBinary) {
				// ^ browsers buffer binary responses, so dont bother streaming
				streamPoller = setInterval(function() {
					// new data?
					var len = xhrRequest.response.length;
					if (len > lenOnLastPoll) {
						var chunk = xhrRequest.response.slice(lenOnLastPoll);
						lenOnLastPoll = len;
						ores.write(chunk);
					}
				}, 50);
			}
		}
		if (xhrRequest.readyState === XMLHttpRequest.DONE) {
			if (streamPoller)
				clearInterval(streamPoller);
			if (ires.status !== 0 && xhrRequest.status === 0 && !xhrRequest.aborted) {
				// a sudden switch to 0 (after getting a non-0) probably means a timeout
				console.debug('XHR looks like it timed out; treating it as a premature close'); // just in case things get weird
				ores.close();
			} else {
				if (xhrRequest.response) {
					if (typeof xhrRequest.response == 'string') {
						var len = xhrRequest.response.length;
						if (len > lenOnLastPoll) {
							ores.write(xhrRequest.response.slice(lenOnLastPoll));
						}
					} else {
						ores.write(xhrRequest.response);
					}
				}
				ores.end();
			}
		}
	};
});

// helper
// pulls non-standard headers out of the request and makes sure they're formatted correctly
var ucRegEx = /([a-z])([A-Z])/g; // lowercase followed by an uppercase
function headerReplacer(all, $1, $2) { return $1+'-'+$2; }
function extractOreqHeaders(headers) {
	var extraHeaders = {};
	for (var k in headers) {
		if (helpers.isHeaderKey(k)) {
			var k2 = k.replace(ucRegEx, headerReplacer);
			extraHeaders[k2] = headers[k];
		}
	}
	return extraHeaders;
}

// Data
// ====
schemes.register('data', function(oreq, ires) {
	var firstColonIndex = oreq.headers.url.indexOf(':');
	var firstCommaIndex = oreq.headers.url.indexOf(',');

	// parse parameters
	var param;
	var params = oreq.headers.url.slice(firstColonIndex+1, firstCommaIndex).split(';');
	var contentType = params.shift();
	var isBase64 = false;
	while ((param = params.shift())) {
		if (param == 'base64')
			isBase64 = true;
	}

	// parse data
	var data = oreq.headers.url.slice(firstCommaIndex+1);
	if (!data) data = '';
	if (isBase64) data = atob(data);
	else data = decodeURIComponent(data);

	// respond
	var ores = new Response();
	ores.wireUp(ires);
	ores.s200().ContentType(contentType);
	ores.end(data);
});