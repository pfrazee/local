// Local HTTP
// ==========
// pfraze 2013

if (typeof this.local == 'undefined')
	this.local = {};
if (typeof this.local.http == 'undefined')
	this.local.http = {};
if (typeof this.local.http.ext == 'undefined')
	this.local.http.ext = {};

(function() {
	function noop() {}// Helpers
// =======

// EXPORTED
// breaks a link header into a javascript object
local.http.parseLinkHeader = function parseLinkHeader(headerStr) {
	if (typeof headerStr !== 'string') {
		return headerStr;
	}
	// '</foo/bar>; rel="baz"; title="blah", </foo/bar>; rel="baz"; title="blah", </foo/bar>; rel="baz"; title="blah"'
	return headerStr.replace(/,[\s]*</g, '|||<').split('|||').map(function(linkStr) {
		// ['</foo/bar>; rel="baz"; title="blah"', '</foo/bar>; rel="baz"; title="blah"']
		var link = {};
		linkStr.trim().split(';').forEach(function(attrStr) {
			// ['</foo/bar>', 'rel="baz"', 'title="blah"']
			attrStr = attrStr.trim();
			if (!attrStr) { return; }
			if (attrStr.charAt(0) === '<') {
				// '</foo/bar>'
				link.href = attrStr.trim().slice(1, -1);
			} else {
				var attrParts = attrStr.split('=');
				// ['rel', '"baz"']
				var k = attrParts[0].trim();
				var v = attrParts[1].trim().slice(1, -1);
				link[k] = v;
			}
		});
		return link;
	});
};

// EXPORTED
// looks up a link in the cache and generates the URI
//  - first looks for a matching rel and title
//    eg lookupLink(links, 'item', 'foobar'), Link: <http://example.com/some/foobar>; rel="item"; title="foobar" -> http://example.com/some/foobar
//  - then looks for a matching rel with no title and uses that to generate the link
//    eg lookupLink(links, 'item', 'foobar'), Link: <http://example.com/some/{title}>; rel="item" -> http://example.com/some/foobar
local.http.lookupLink = function lookupLink(links, rel, title) {
	var len = links ? links.length : 0;
	if (!len) { return null; }

	title = title.toLowerCase();

	// try to find the link with a title equal to the param we were given
	var match = null;
	for (var i=0; i < len; i++) {
		var link = links[i];
		if (!link) { continue; }
		// find all links with a matching rel
		if (link.rel && link.rel.indexOf(rel) !== -1) {
			// look for a title match to the primary parameter
			if (link.title) {
				if (link.title.toLowerCase() === title) {
					match = link;
					break;
				}
			} else {
				// no title attribute -- it's the template URI, so hold onto it
				match = link;
			}
		}
	}

	return match ? match.href : null;
};

// EXPORTED
// correctly joins together to url segments
local.http.joinUrl = function joinUrl() {
	var parts = Array.prototype.map.call(arguments, function(arg) {
		var lo = 0, hi = arg.length;
		if (arg.charAt(0) === '/')      { lo += 1; }
		if (arg.charAt(hi - 1) === '/') { hi -= 1; }
		return arg.substring(lo, hi);
	});
	return parts.join('/');
};

// EXPORTED
// converts any known header objects into their string versions
local.http.serializeRequestHeaders = function(headers) {
	if (headers.authorization && typeof headers.authorization == 'object') {
		if (!headers.authorization.scheme) { throw "`scheme` required for auth headers"; }
		var auth;
		switch (headers.authorization.scheme.toLowerCase()) {
			case 'basic':
				auth = 'Basic '+btoa(headers.authorization.name+':'+headers.authorization.password);
				break;
			case 'persona':
				auth = 'Persona name='+headers.authorization.name+' assertion='+headers.authorization.assertion;
				break;
			default:
				throw "unknown auth sceme: "+headers.authorization.scheme;
		}
		headers.authorization = auth;
	}
};

// EXPORTED
// parseUri 1.2.2, (c) Steven Levithan <stevenlevithan.com>, MIT License
local.http.parseUri = function parseUri(str) {
	if (typeof str === 'object') {
		if (str.url) { str = str.url; }
		else if (str.host || str.path) { str = local.http.joinUrl(req.host, req.path); }
	}
	var	o   = local.http.parseUri.options,
		m   = o.parser[o.strictMode ? "strict" : "loose"].exec(str),
		uri = {},
		i   = 14;

	while (i--) uri[o.key[i]] = m[i] || "";

	uri[o.q.name] = {};
	uri[o.key[12]].replace(o.q.parser, function ($0, $1, $2) {
		if ($1) uri[o.q.name][$1] = $2;
	});

	return uri;
};

local.http.parseUri.options = {
	strictMode: false,
	key: ["source","protocol","authority","userInfo","user","password","host","port","relative","path","directory","file","query","anchor"],
	q:   {
		name:   "queryKey",
		parser: /(?:^|&)([^&=]*)=?([^&]*)/g
	},
	parser: {
		strict: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,
		loose:  /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/
	}
};


// sends the given response back verbatim
// - if `writeHead` has been previously called, it will not change
// - params:
//   - `target`: the response to populate
//   - `source`: the response to pull data from
//   - `headersCb`: (optional) takes `(headers)` from source and responds updated headers for target
//   - `bodyCb`: (optional) takes `(body)` from source and responds updated body for target
local.http.pipe = function(target, source, headersCB, bodyCb) {
	headersCB = headersCB || function(v) { return v; };
	bodyCb = bodyCb || function(v) { return v; };
	return local.promise(source)
		.succeed(function(source) {
			if (!target.status) {
				// copy the header if we don't have one yet
				target.writeHead(source.status, source.reason, headersCB(source.headers));
			}
			if (source.body !== null && typeof source.body != 'undefined') { // already have the body?
				target.write(bodyCb(source.body));
			}
			if (source.on && source.isConnOpen) {
				// wire up the stream
				source.on('data', function(data) {
					target.write(bodyCb(data));
				});
				source.on('end', function() {
					target.end();
				});
			} else {
				target.end();
			}
			return target;
		})
		.fail(function(source) {
			var ctype = source.headers['content-type'] || 'text/plain';
			var body = (ctype && source.body) ? source.body : '';
			target.writeHead(502, 'bad gateway', {'content-type':ctype});
			target.end(body);
			throw source;
		});
};// contentTypes
// ============
// EXPORTED
// provides serializers and deserializers for MIME types
var contentTypes = {
	serialize   : contentTypes__serialize,
	deserialize : contentTypes__deserialize,
	register    : contentTypes__register
};
var contentTypes__registry = {};
local.http.contentTypes = contentTypes;

// EXPORTED
// serializes an object into a string
function contentTypes__serialize(obj, type) {
	if (!obj || typeof(obj) != 'object' || !type) {
		return obj;
	}
	var fn = contentTypes__find(type, 'serializer');
	if (!fn) {
		return obj;
	}
	return fn(obj);
}

// EXPORTED
// deserializes a string into an object
function contentTypes__deserialize(str, type) {
	if (!str || typeof(str) != 'string' || !type) {
		return str;
	}
	var fn = contentTypes__find(type, 'deserializer');
	if (!fn) {
		return str;
	}
	return fn(str);
}

// EXPORTED
// adds a type to the registry
function contentTypes__register(type, serializer, deserializer) {
	contentTypes__registry[type] = {
		serializer   : serializer,
		deserializer : deserializer
	};
}

// INTERNAL
// takes a mimetype (text/asdf+html), puts out the applicable types ([text/asdf+html, text/html, text])
function contentTypes__mkTypesList(type) {
	var parts = type.split(';');
	var t = parts[0];
	parts = t.split('/');
	if (parts[1]) {
		var parts2 = parts[1].split('+');
		if (parts2[1]) {
			return [t, parts[0] + '/' + parts2[1], parts[0]];
		}
		return [t, parts[0]];
	}
	return [t];
}

// INTERNAL
// finds the closest-matching type in the registry and gives the request function
function contentTypes__find(type, fn) {
	var types = contentTypes__mkTypesList(type);
	for (var i=0; i < types.length; i++) {
		if (types[i] in contentTypes__registry)
			return contentTypes__registry[types[i]][fn];
	}
	return null;
}

// Default Types
// =============
local.http.contentTypes.register('application/json',
	function (obj) {
		try {
			return JSON.stringify(obj);
		} catch (e) {
			return e.message;
		}
	},
	function (str) {
		try {
			return JSON.parse(str);
		} catch (e) {
			return e.message;
		}
	}
);
local.http.contentTypes.register('application/x-www-form-urlencoded',
	function (obj) {
		var enc = encodeURIComponent;
		var str = [];
		for (var k in obj) {
			if (obj[k] === null) {
				str.push(k+'=');
			} else if (Array.isArray(obj[k])) {
				for (var i=0; i < obj[k].length; i++) {
					str.push(k+'[]='+enc(obj[k][i]));
				}
			} else if (typeof obj[k] == 'object') {
				for (var k2 in obj[k]) {
					str.push(k+'['+k2+']='+enc(obj[k][k2]));
				}
			} else {
				str.push(k+'='+enc(obj[k]));
			}
		}
		return str.join('&');
	},
	function (params) {
		// thanks to Brian Donovan
		// http://stackoverflow.com/a/4672120
		var pairs = params.split('&'),
		result = {};

		for (var i = 0; i < pairs.length; i++) {
			var pair = pairs[i].split('='),
			key = decodeURIComponent(pair[0]),
			value = decodeURIComponent(pair[1]),
			isArray = /\[\]$/.test(key),
			dictMatch = key.match(/^(.+)\[([^\]]+)\]$/);

			if (dictMatch) {
				key = dictMatch[1];
				var subkey = dictMatch[2];

				result[key] = result[key] || {};
				result[key][subkey] = value;
			} else if (isArray) {
				key = key.substring(0, key.length-2);
				result[key] = result[key] || [];
				result[key].push(value);
			} else {
				result[key] = value;
			}
		}

		return result;
	}
);// Core
// ====
// :KNOWN BUGS:
// - currently, Firefox is not able to retrieve response headers over CORS

// stores local server functions
var __httpl_registry = {};

// request dispatcher func
// - used in workers to transport requests to the parent for routing
var __customRequestDispatcher = null;

// the directory of the environment context
var __windowLocationDirname = (typeof window != 'undefined') ? window.location.pathname.split('/') : [''];
__windowLocationDirname[__windowLocationDirname.length - 1] = '';
__windowLocationDirname = __windowLocationDirname.join('/');

// fulfills/reject a promise for a response with the given response
function fulfillResponsePromise(promise, response) {
	// wasnt streaming, fulfill now that full response is collected
	if (response.status >= 200 && response.status < 400)
		promise.fulfill(response);
	else if (response.status >= 400 && response.status < 600 || response.status === 0)
		promise.reject(response);
	else
		promise.fulfill(response); // :TODO: 1xx protocol handling
}

// dispatch()
// ==========
// EXPORTED
// HTTP request dispatcher
// - `req` param:
//   - requires `method`, `body`, and the target url
//   - target url can be passed in options as `url`, or generated from `host` and `path`
//   - query parameters may be passed in `query`
//   - extra request headers may be specified in `headers`
//   - if `stream` is true, the ClientResponse 'data' events will be called as soon as headers or data are received
// - returns a `Promise` object
//   - on success (status code 2xx), the promise is fulfilled with a `ClientResponse` object
//   - on failure (status code 4xx,5xx), the promise is rejected with a `ClientResponse` object
//   - all protocol (status code 1xx,3xx) is handled internally
local.http.dispatch = function dispatch(req) {
	// sanity check
	if (!req) { throw "no req param provided to request"; }

	// sane defaults
	req.headers = req.headers || {};
	req.query = req.query || {};

	// dispatch behavior override
	// (used by workers to send requests to the parent document for routing)
	if (__customRequestDispatcher)
		return __customRequestDispatcher(req);

	// parse the url
	// (urld = url description)
	if (!req.url)
		req.url = local.http.joinUrl(req.host, req.path);
	req.urld = local.http.parseUri(req.url);
	if (!req.urld)
		throw "no URL or host/path provided in request";

	// prepend host on relative path
	if (!req.urld.protocol) {
		if (req.url.length > 0 && req.url.charAt(0) != '/') {
			// relative to current dirname
			req.url = window.location.protocol + "//" + window.location.host + __windowLocationDirname + req.url;
		} else {
			// relative to current hose
			req.url = window.location.protocol + "//" + window.location.host + req.url;
		}
		req.urld = local.http.parseUri(req.url);
	}

	// execute (asyncronously) by protocol
	var resPromise = local.promise();
	if (req.urld.protocol == 'httpl')
		setTimeout(function() { __dispatchLocal(req, resPromise); }, 0);
	else if (req.urld.protocol == 'http' || req.urld.protocol == 'https')
		setTimeout(function() { __dispatchRemote(req, resPromise); }, 0);
	else {
		var res = new ClientResponse(0, 'unsupported protocol "'+req.urld.protocol+'"');
		resPromise.reject(res);
		res.end();
	}
	return resPromise;
};

// executes a request locally
function __dispatchLocal(req, resPromise) {

	// find the local server
	var server = __httpl_registry[req.urld.host];
	if (!server) {
		var res = new ClientResponse(404, 'server not found');
		resPromise.reject(res);
		res.end();
		return;
	}

	// rebuild the request
	// :NOTE: could just pass `req`, but would rather be explicit about what a local server receives
	var req2 = {
		path    : req.urld.path,
		method  : req.method,
		query   : req.query || {},
		headers : req.headers || {},
		body    : req.body,
		stream  : req.stream
	};

	// if the urld has query parameters, mix them into the request's query object
	if (req.urld.query) {
		var q = local.http.contentTypes.deserialize(req.urld.query, 'application/x-www-form-urlencoded');
		for (var k in q) {
			req2.query[k] = q[k];
		}
	}

	// pass on to the server
	server.fn.call(server.context, req2, new ServerResponse(resPromise, req.stream));
}

// executes a request remotely
function __dispatchRemote(req, resPromise) {

	// if a query was given in the options, mix it into the urld
	if (req.query) {
		var q = local.http.contentTypes.serialize(req.query, 'application/x-www-form-urlencoded');
		if (q) {
			if (req.urld.query) {
				req.urld.query    += '&' + q;
				req.urld.relative += '&' + q;
			} else {
				req.urld.query     =  q;
				req.urld.relative += '?' + q;
			}
		}
	}

	if (typeof window != 'undefined')
		__dispatchRemoteBrowser(req, resPromise);
	else
		__dispatchRemoteNodejs(req, resPromise);
}

// executes a remote request in the browser
function __dispatchRemoteBrowser(req, resPromise) {

	// assemble the final url
	var url = ((req.urld.protocol) ? (req.urld.protocol + '://') : '') + req.urld.authority + req.urld.relative;

	// make sure our payload is serialized
	local.http.serializeRequestHeaders(req.headers);
	if (req.body !== null && typeof req.body != 'undefined') {
		req.headers['content-type'] = req.headers['content-type'] || 'application/json';
		if (typeof req.body !== 'string') {
			req.body = local.http.contentTypes.serialize(req.body, req.headers['content-type']);
		}
	}

	// create the request
	var xhrRequest = new XMLHttpRequest();
	xhrRequest.open(req.method, url, true);

	for (var k in req.headers) {
		if (req.headers[k] !== null && req.headers.hasOwnProperty(k))
			xhrRequest.setRequestHeader(k, req.headers[k]);
	}

	var clientResponse, streamPoller=0, lenOnLastPoll=0;
	xhrRequest.onreadystatechange = function() {
		if (xhrRequest.readyState >= XMLHttpRequest.HEADERS_RECEIVED && !clientResponse) {
			clientResponse = new ClientResponse(xhrRequest.status, xhrRequest.statusText);

			// :NOTE: a bug in firefox causes getAllResponseHeaders to return an empty string on CORS
			// we either need to bug them, or iterate the headers we care about with getResponseHeader
			xhrRequest.getAllResponseHeaders().split("\n").forEach(function(h) {
				if (!h) { return; }
				var kv = h.toLowerCase().replace('\r','').split(': ');
				clientResponse.headers[kv[0]] = kv[1];
			});

			// parse any headers we need
			if (clientResponse.headers.link)
				clientResponse.headers.link = local.http.parseLinkHeader(clientResponse.headers.link);

			if (req.stream) {
				// streaming, fulfill ahead of response close
				fulfillResponsePromise(resPromise, clientResponse);

				// start polling for updates
				streamPoller = setInterval(function() {
					// new data?
					var len = xhrRequest.responseText.length;
					if (len > lenOnLastPoll) {
						lenOnLastPoll = len;
						clientResponse.write(xhrRequest.responseText, true);
					}
				}, req.streamPoll || 500);
			}
		}
		if (xhrRequest.readyState === XMLHttpRequest.DONE) {
			clientResponse = clientResponse || new ClientResponse(xhrRequest.status, xhrRequest.statusText);
			if (streamPoller)
				clearInterval(streamPoller);
			clientResponse.write(xhrRequest.responseText, true);
			clientResponse.end();

			if (!req.stream) {
				// wasnt streaming, fulfill now that full response is collected
				fulfillResponsePromise(resPromise, clientResponse);
			}

		}
	};
	xhrRequest.send(req.body);
}

// executes a remote request in a nodejs process
function __dispatchRemoteNodejs(req, resPromise) {
	var res = new ClientResponse(0, 'dispatch() has not yet been implemented for nodejs');
	resPromise.reject(res);
	res.end();
}

// EXPORTED
// allows the API consumer to dispatch requests with their own code
// - mainly for workers to submit requests to the document for routing
local.http.setRequestDispatcher = function setRequestDispatcher(fn) {
	__customRequestDispatcher = fn;
};

// ClientResponse
// ==============
// EXPORTED
// Interface for receiving responses
// - generated internally and returned by `request`
// - used by ServerResponse (for local servers) and by the remote request handler code
// - emits 'data' events when a streaming request receives data
// - emits an 'end' event when the connection is ended
// - if the request is not streaming, the response body will be present in `body` (and no 'end' event is needed)
function ClientResponse(status, reason) {
	local.util.EventEmitter.call(this);

	this.status = status;
	this.reason = reason;
	this.headers = {};
	this.body = null;
	this.isConnOpen = true;
}
local.http.ClientResponse = ClientResponse;
ClientResponse.prototype = Object.create(local.util.EventEmitter.prototype);

// adds data to the response stream
// - if `overwrite` is false, will append to accumulated response
// - if `overwrite` is true, will overwrite the accumulated response
//   - but the 'data' event will only include the data that was new to the response's accumulation
//     (that is, if this.body=='foo', and response.write('foobar', true), the 'data' event will include 'bar' only)
ClientResponse.prototype.write = function(data, overwrite) {
	if (!overwrite && typeof data == 'string' && typeof this.body == 'string') {
		// add to the buffer if its a string
		this.body += data;
	} else {
		// overwrite otherwise
		var oldLen = (this.body && typeof this.body == 'string') ? this.body.length : 0;
		this.body = data;
		data = (typeof data == 'string') ? data.slice(oldLen) : data; // slice out what we already had, for the emit
	}
	this.emit('data', data);
};

ClientResponse.prototype.end = function() {
	// now that we have it all, try to deserialize the payload
	this.__deserialize();
	this.isConnOpen = false;
	this.emit('end');
};

// this helper is called when the data finishes coming down
ClientResponse.prototype.__deserialize = function() {
	// convert from string to an object (if we have a deserializer available)
	if (typeof this.body == 'string')
		this.body = local.http.contentTypes.deserialize(this.body, this.headers['content-type']);
};

// ServerResponse
// ==============
// EXPORTED
// Interface for local servers to respond to requests
// - generated internally and given to local servers
// - not given to clients; instead, interfaces with the ClientResponse given to the client
function ServerResponse(resPromise, isStreaming) {
	local.util.EventEmitter.call(this);

	this.resPromise  = resPromise;
	this.isStreaming = isStreaming;
	this.clientResponse = new ClientResponse();
}
local.http.ServerResponse = ServerResponse;
ServerResponse.prototype = Object.create(local.util.EventEmitter.prototype);

// writes the header to the response
// if streaming, will notify the client
ServerResponse.prototype.writeHead = function(status, reason, headers) {
	// setup client response
	this.clientResponse.status = status;
	this.clientResponse.reason = reason;
	for (var k in headers) {
		if (headers.hasOwnProperty(k))
			this.setHeader(k, headers[k]);
	}

	// fulfill/reject
	if (this.isStreaming) { fulfillResponsePromise(this.resPromise, this.clientResponse); }
	return this;
};

// header access/mutation fns
ServerResponse.prototype.setHeader    = function(k, v) { this.clientResponse.headers[k] = v; };
ServerResponse.prototype.getHeader    = function(k) { return this.clientResponse.headers[k]; };
ServerResponse.prototype.removeHeader = function(k) { delete this.clientResponse.headers[k]; };

// writes data to the response
// if streaming, will notify the client
ServerResponse.prototype.write = function(data) {
	this.clientResponse.write(data, false);
	return this;
};

// ends the response, optionally writing any final data
ServerResponse.prototype.end = function(data) {
	// write any remaining data
	if (data) { this.write(data); }

	this.clientResponse.end();
	this.emit('close');

	// fulfill/reject now if we had been buffering the response
	if (!this.isStreaming)
		fulfillResponsePromise(this.resPromise, this.clientResponse);

	// unbind all listeners
	this.removeAllListeners('close');
	this.clientResponse.removeAllListeners('data');
	this.clientResponse.removeAllListeners('end');

	return this;
};

// functions added just to compat with nodejs
ServerResponse.prototype.writeContinue = noop;
ServerResponse.prototype.addTrailers   = noop;
ServerResponse.prototype.sendDate      = noop; // :TODO: is this useful?


// registerLocal()
// ===============
// EXPORTED
// adds a server to the httpl registry
local.http.registerLocal = function registerLocal(domain, server, serverContext) {
	var urld = local.http.parseUri(domain);
	if (urld.protocol && urld.protocol !== 'httpl') throw "registerLocal can only add servers to the httpl protocol";
	if (!urld.host) throw "invalid domain provided to registerLocal";
	if (__httpl_registry[urld.host]) throw "server already registered at domain given to registerLocal";
	__httpl_registry[urld.host] = { fn:server, context:serverContext };
};

// unregisterLocal()
// =================
// EXPORTED
// removes a server from the httpl registry
local.http.unregisterLocal = function unregisterLocal(domain) {
	var urld = local.http.parseUri(domain);
	if (!urld.host) {
		throw "invalid domain provided toun registerLocal";
	}
	if (__httpl_registry[urld.host]) {
		delete __httpl_registry[urld.host];
	}
};

// getLocal()
// ==========
// EXPORTED
// retrieves a server from the httpl registry
local.http.getLocal = function getLocal(domain) {
	var urld = local.http.parseUri(domain);
	if (!urld.host) {
		throw "invalid domain provided toun registerLocal";
	}
	return __httpl_registry[urld.host];
};

// getLocalRegistry()
// ==================
// EXPORTED
// retrieves the httpl registry
local.http.getLocalRegistry = function getLocalRegistry() {
	return __httpl_registry;
};// Events
// ======
// :NOTE: currently, Chrome does not support event streams with CORS

// the directory of the environment context
var __windowLocationDirname = (typeof window != 'undefined') ? window.location.pathname.split('/') : [''];
__windowLocationDirname[__windowLocationDirname.length - 1] = '';
__windowLocationDirname = __windowLocationDirname.join('/');

// event subscriber func
// - used in workers to transport subscribes to the parent for routing
var __customEventSubscriber = null;

// subscribe()
// ===========
// EXPORTED
// Establishes a connection and begins an event stream
// - sends a GET request with 'text/event-stream' as the Accept header
// - `req` param:
//   - requires the target url
//   - target url can be passed in req as `url`, or generated from `host` and `path`
// - returns a `EventStream` object
local.http.subscribe = function subscribe(req) {

	if (!req) { throw "no options provided to subscribe"; }
	if (typeof req == 'string') {
		req = { url:req };
	}

	// subscribe behavior override
	// (used by workers to send subscribes to the parent document for routing)
	if (__customEventSubscriber)
		return __customEventSubscriber(req);

	// parse the url
	// (urld = url description)
	if (!req.url)
		req.url = local.http.joinUrl(req.host, req.path);
	req.urld = local.http.parseUri(req.url);
	if (!req.urld)
		throw "no URL or host/path provided in request";

	// prepend host on relative path
	if (!req.urld.protocol) {
		if (req.url.length > 0 && req.url.charAt(0) != '/') {
			// relative to current dirname
			req.url = window.location.protocol + "//" + window.location.host + __windowLocationDirname + req.url;
		} else {
			// relative to current hose
			req.url = window.location.protocol + "//" + window.location.host + req.url;
		}
		req.urld = local.http.parseUri(req.url);
	}

	// execute according to protocol
	if (req.urld.protocol == 'httpl')
		return __subscribeLocal(req);
	else
		return __subscribeRemote(req);
};

// subscribes to a local host
function __subscribeLocal(req) {

	// initiate the event stream
	var stream = new LocalEventStream(local.http.dispatch({
		method  : 'get',
		url     : 'httpl://' + req.urld.authority + req.urld.relative,
		headers : { accept : 'text/event-stream' },
		stream  : true
	}));
	return stream;
}

// subscribes to a remote host
function __subscribeRemote(req) {
	if (typeof window != 'undefined')
		return __subscribeRemoteBrowser(req);
	else
		return __subscribeRemoteNodejs(req);
}

// subscribes to a remote host in the browser
function __subscribeRemoteBrowser(req) {

	// assemble the final url
	var url = (req.urld.protocol || 'http') + '://' + req.urld.authority + req.urld.relative;

	// initiate the event stream
	return new BrowserRemoteEventStream(url);
}

// subscribes to a remote host in a nodejs process
function __subscribeRemoteNodejs(req) {
	throw "subscribe() has not yet been implemented for nodejs";
}

// EXPORTED
// allows the API consumer to handle subscribes with their own code
// - mainly for workers to submit subscribes to the document for routing
local.http.setEventSubscriber = function setEventSubscriber(fn) {
	__customEventSubscriber = fn;
};

// EventStream
// ===========
// EXPORTED
// provided by subscribe() to manage the events
function EventStream() {
	local.util.EventEmitter.call(this);
	this.isConnOpen = true;
}
local.http.EventStream = EventStream;
EventStream.prototype = Object.create(local.util.EventEmitter.prototype);
EventStream.prototype.close = function() {
	this.isConnOpen = false;
	this.removeAllListeners();
};
EventStream.prototype.__emitError = function(e) {
	this.emit('message', e);
	this.emit('error', e);
};
EventStream.prototype.__emitEvent = function(e) {
	this.emit('message', e);
	this.emit(e.event, e);
};

// LocalEventStream
// ================
// INTERNAL
// descendent of EventStream
function LocalEventStream(resPromise) {
	EventStream.call(this);

	// wait for the promise
	var self = this;
	resPromise.then(
		function(response) {
			response.on('data', function(payload) {
				self.__emitEvent(payload);
			});
			response.on('end', function() {
				self.close();
			});
		},
		function(response) {
			self.__emitError({ event:'error', data:response });
			self.close();
		}
	);
}
local.http.LocalEventStream = LocalEventStream;
LocalEventStream.prototype = Object.create(EventStream.prototype);
LocalEventStream.prototype.close = function() {
	this.__emitError({ event:'error', data:undefined }); // :NOTE: emulating the behavior of EventSource
	// :TODO: would be great if close didn't emit the above error
	EventStream.prototype.close.call(this);
};

// BrowserRemoteEventStream
// ========================
// INTERNAL
// descendent of EventStream, abstracts over EventSource
function BrowserRemoteEventStream(url) {
	EventStream.call(this);

	// establish the connection to the remote source
	this.eventSource = new EventSource(url);
	// wire it up to our functions
	var self = this;
	this.eventSource.onerror = function(e) {
		if (e.target.readyState == EventSource.CLOSED)
			self.close();
	};
}
local.http.BrowserRemoteEventStream = BrowserRemoteEventStream;
BrowserRemoteEventStream.prototype = Object.create(EventStream.prototype);
BrowserRemoteEventStream.prototype.addListener = function(type, listener) {
	if (Array.isArray(type)) {
		type.forEach(function(t) { this.addListener(t, listener); }, this);
		return;
	}
	if (!this._events[type]) {
		// if this is the first add to the event stream, register our interest with the event source
		var self = this;
		this.eventSource.addEventListener(type, function(e) {
			var data = e.data;
			try { data = JSON.parse(data); } catch(err) {}
			self.__emitEvent({ event:e.type, data:data });
		});
	}
	local.util.EventEmitter.prototype.addListener.call(this, type, listener);
};
BrowserRemoteEventStream.prototype.on = BrowserRemoteEventStream.prototype.addListener;
BrowserRemoteEventStream.prototype.close = function() {
	this.eventSource.close();
	this.eventSource.onerror = null;
	this.eventSource = null;
	EventStream.prototype.close.call(this);
};

// Broadcaster
// ===========
// EXPORTED
// a wrapper for event-streams
function Broadcaster() {
	this.streams = [];
}
local.http.Broadcaster = Broadcaster;

// listener management
Broadcaster.prototype.addStream = function(responseStream) {
	this.streams.push(responseStream);
	// :TODO listen for close?
};
Broadcaster.prototype.endStream = function(responseStream) {
	this.streams = this.streams.filter(function(rS) { return rS != responseStream; });
	responseStream.end();
};
Broadcaster.prototype.endAllStreams = function() {
	this.streams.forEach(function(rS) { rS.end(); });
	this.streams.length = 0;
};

// sends an event to all streams
Broadcaster.prototype.emit = function(eventName, data) {
	this.streams.forEach(function(rS) { this.emitTo(rS, eventName, data); }, this);
};

// sends an event to the given response stream
Broadcaster.prototype.emitTo = function(responseStream, eventName, data) {
	responseStream.write({ event:eventName, data:data });
};

// wrap helper
local.http.broadcaster = function() {
	return new Broadcaster();
};// UriTemplate
// ===========
// https://github.com/fxa/uritemplate-js
// Copyright 2012 Franz Antesberger, MIT License
(function (){
	"use strict";

	// http://blog.sangupta.com/2010/05/encodeuricomponent-and.html
	//
	// helpers
	//
	function isArray(value) {
		return Object.prototype.toString.apply(value) === '[object Array]';
	}

	// performs an array.reduce for objects
	function objectReduce(object, callback, initialValue) {
		var
			propertyName,
			currentValue = initialValue;
		for (propertyName in object) {
			if (object.hasOwnProperty(propertyName)) {
				currentValue = callback(currentValue, object[propertyName], propertyName, object);
			}
		}
		return currentValue;
	}

	// performs an array.reduce, if reduce is not present (older browser...)
	function arrayReduce(array, callback, initialValue) {
		var
			index,
			currentValue = initialValue;
		for (index = 0; index < array.length; index += 1) {
			currentValue = callback(currentValue, array[index], index, array);
		}
		return currentValue;
	}

	function reduce(arrayOrObject, callback, initialValue) {
		return isArray(arrayOrObject) ? arrayReduce(arrayOrObject, callback, initialValue) : objectReduce(arrayOrObject, callback, initialValue);
	}

	/**
	 * Detects, whether a given element is defined in the sense of rfc 6570
	 * Section 2.3 of the RFC makes clear defintions:
	 * * undefined and null are not defined.
	 * * the empty string is defined
	 * * an array ("list") is defined, if it contains at least one defined element
	 * * an object ("map") is defined, if it contains at least one defined property
	 * @param object
	 * @return {Boolean}
	 */
	function isDefined (object) {
		var
			index,
			propertyName;
		if (object === null || object === undefined) {
			return false;
		}
		if (isArray(object)) {
			for (index = 0; index < object.length; index +=1) {
				if(isDefined(object[index])) {
					return true;
				}
			}
			return false;
		}
		if (typeof object === "string" || typeof object === "number" || typeof object === "boolean") {
			// even the empty string is considered as defined
			return true;
		}
		// else Object
		for (propertyName in object) {
			if (object.hasOwnProperty(propertyName) && isDefined(object[propertyName])) {
				return true;
			}
		}
		return false;
	}

	function isAlpha(chr) {
		return (chr >= 'a' && chr <= 'z') || ((chr >= 'A' && chr <= 'Z'));
	}

	function isDigit(chr) {
		return chr >= '0' && chr <= '9';
	}

	function isHexDigit(chr) {
		return isDigit(chr) || (chr >= 'a' && chr <= 'f') || (chr >= 'A' && chr <= 'F');
	}

	var pctEncoder = (function () {

		// see http://ecmanaut.blogspot.de/2006/07/encoding-decoding-utf8-in-javascript.html
		function toUtf8 (s) {
			return unescape(encodeURIComponent(s));
		}

		function encode(chr) {
			var
				result = '',
				octets = toUtf8(chr),
				octet,
				index;
			for (index = 0; index < octets.length; index += 1) {
				octet = octets.charCodeAt(index);
				result += '%' + octet.toString(16).toUpperCase();
			}
			return result;
		}

		function isPctEncoded (chr) {
			if (chr.length < 3) {
				return false;
			}
			for (var index = 0; index < chr.length; index += 3) {
				if (chr.charAt(index) !== '%' || !isHexDigit(chr.charAt(index + 1) || !isHexDigit(chr.charAt(index + 2)))) {
					return false;
				}
			}
			return true;
		}

		function pctCharAt(text, startIndex) {
			var chr = text.charAt(startIndex);
			if (chr !== '%') {
				return chr;
			}
			chr = text.substr(startIndex, 3);
			if (!isPctEncoded(chr)) {
				return '%';
			}
			return chr;
		}

		return {
			encodeCharacter: encode,
			decodeCharacter: decodeURIComponent,
			isPctEncoded: isPctEncoded,
			pctCharAt: pctCharAt
		};
	}());


	/**
	 * Returns if an character is an varchar character according 2.3 of rfc 6570
	 * @param chr
	 * @return (Boolean)
	 */
	function isVarchar(chr) {
		return isAlpha(chr) || isDigit(chr) || chr === '_' || pctEncoder.isPctEncoded(chr);
	}

	/**
	 * Returns if chr is an unreserved character according 1.5 of rfc 6570
	 * @param chr
	 * @return {Boolean}
	 */
	function isUnreserved(chr) {
		return isAlpha(chr) || isDigit(chr) || chr === '-' || chr === '.' || chr === '_' || chr === '~';
	}

	/**
	 * Returns if chr is an reserved character according 1.5 of rfc 6570
	 * @param chr
	 * @return {Boolean}
	 */
	function isReserved(chr) {
		return chr === ':' || chr === '/' || chr === '?' || chr === '#' || chr === '[' || chr === ']' || chr === '@' || chr === '!' || chr === '$' || chr === '&' || chr === '(' ||
			chr === ')' || chr === '*' || chr === '+' || chr === ',' || chr === ';' || chr === '=' || chr === "'";
	}

	function encode(text, passReserved) {
		var
			result = '',
			index,
			chr = '';
		if (typeof text === "number" || typeof text === "boolean") {
			text = text.toString();
		}
		for (index = 0; index < text.length; index += chr.length) {
			chr = pctEncoder.pctCharAt(text, index);
			if (chr.length > 1) {
				result += chr;
			}
			else {
				result += isUnreserved(chr) || (passReserved && isReserved(chr)) ? chr : pctEncoder.encodeCharacter(chr);
			}
		}
		return result;
	}

	function encodePassReserved(text) {
		return encode(text, true);
	}

	var
		operators = (function () {
			var
				bySymbol = {};
			function create(symbol) {
				bySymbol[symbol] = {
					symbol: symbol,
					separator: (symbol === '?') ? '&' : (symbol === '' || symbol === '+' || symbol === '#') ? ',' : symbol,
					named: symbol === ';' || symbol === '&' || symbol === '?',
					ifEmpty: (symbol === '&' || symbol === '?') ? '=' : '',
					first: (symbol === '+' ) ? '' : symbol,
					encode: (symbol === '+' || symbol === '#') ? encodePassReserved : encode,
					toString: function () {return this.symbol;}
				};
			}
			create('');
			create('+');
			create('#');
			create('.');
			create('/');
			create(';');
			create('?');
			create('&');
			return {valueOf: function (chr) {
				if (bySymbol[chr]) {
					return bySymbol[chr];
				}
				if ("=,!@|".indexOf(chr) >= 0) {
					throw new Error('Illegal use of reserved operator "' + chr + '"');
				}
				return bySymbol[''];
			}};
		}());

	function UriTemplate(templateText, expressions) {
		this.templateText = templateText;
		this.expressions = expressions;
	}

	UriTemplate.prototype.toString = function () {
		return this.templateText;
	};

	UriTemplate.prototype.expand = function (variables) {
		var
			index,
			result = '';
		for (index = 0; index < this.expressions.length; index += 1) {
			result += this.expressions[index].expand(variables);
		}
		return result;
	};

	function encodeLiteral(literal) {
		var
			result = '',
			index,
			chr = '';
		for (index = 0; index < literal.length; index += chr.length) {
			chr = pctEncoder.pctCharAt(literal, index);
			if (chr.length > 0) {
				result += chr;
			}
			else {
				result += isReserved(chr) || isUnreserved(chr) ? chr : pctEncoder.encodeCharacter(chr);
			}
		}
		return result;
	}

	function LiteralExpression(literal) {
		this.literal = encodeLiteral(literal);
	}

	LiteralExpression.prototype.expand = function () {
		return this.literal;
	};

	LiteralExpression.prototype.toString = LiteralExpression.prototype.expand;

	function VariableExpression(templateText, operator, varspecs) {
		this.templateText = templateText;
		this.operator = operator;
		this.varspecs = varspecs;
	}

	VariableExpression.prototype.toString = function () {
		return this.templateText;
	};
	
	VariableExpression.prototype.expand = function expandExpression(variables) {
		var
			result = '',
			index,
			varspec,
			value,
			valueIsArr,
			isFirstVarspec = true,
			operator = this.operator;

		// callback to be used within array.reduce
		function reduceUnexploded(result, currentValue, currentKey) {
			if (isDefined(currentValue)) {
				if (result.length > 0) {
					result += ',';
				}
				if (!valueIsArr) {
					result += operator.encode(currentKey) + ',';
				}
				result += operator.encode(currentValue);
			}
			return result;
		}

		function reduceNamedExploded(result, currentValue, currentKey) {
			if (isDefined(currentValue)) {
				if (result.length > 0) {
					result += operator.separator;
				}
				result += (valueIsArr) ? encodeLiteral(varspec.varname) : operator.encode(currentKey);
				result += '=' + operator.encode(currentValue);
			}
			return result;
		}

		function reduceUnnamedExploded(result, currentValue, currentKey) {
			if (isDefined(currentValue)) {
				if (result.length > 0) {
					result += operator.separator;
				}
				if (!valueIsArr) {
					result += operator.encode(currentKey) + '=';
				}
				result += operator.encode(currentValue);
			}
			return result;
		}

		// expand each varspec and join with operator's separator
		for (index = 0; index < this.varspecs.length; index += 1) {
			varspec = this.varspecs[index];
			value = variables[varspec.varname];
			if (!isDefined(value)) {
				continue;
			}
			if (isFirstVarspec)  {
				result += this.operator.first;
				isFirstVarspec = false;
			}
			else {
				result += this.operator.separator;
			}
			valueIsArr = isArray(value);
			if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
				value = value.toString();
				if (this.operator.named) {
					result += encodeLiteral(varspec.varname);
					if (value === '') {
						result += this.operator.ifEmpty;
						continue;
					}
					result += '=';
				}
				if (varspec.maxLength && value.length > varspec.maxLength) {
					value = value.substr(0, varspec.maxLength);
				}
				result += this.operator.encode(value);
			}
			else if (varspec.maxLength) {
				// 2.4.1 of the spec says: "Prefix modifiers are not applicable to variables that have composite values."
				throw new Error('Prefix modifiers are not applicable to variables that have composite values. You tried to expand ' + this + " with " + JSON.stringify(value));
			}
			else if (!varspec.exploded) {
				if (operator.named) {
					result += encodeLiteral(varspec.varname);
					if (!isDefined(value)) {
						result += this.operator.ifEmpty;
						continue;
					}
					result += '=';
				}
				result += reduce(value, reduceUnexploded, '');
			}
			else {
				// exploded and not string
				result += reduce(value, operator.named ? reduceNamedExploded : reduceUnnamedExploded, '');
			}
		}
		return result;
	};

	function parseExpression(outerText) {
		var
			text,
			operator,
			varspecs = [],
			varspec = null,
			varnameStart = null,
			maxLengthStart = null,
			index,
			chr;

		function closeVarname() {
			varspec = {varname: text.substring(varnameStart, index), exploded: false, maxLength: null};
			varnameStart = null;
		}

		function closeMaxLength() {
			if (maxLengthStart === index) {
				throw new Error("after a ':' you have to specify the length. position = " + index);
			}
			varspec.maxLength = parseInt(text.substring(maxLengthStart, index), 10);
			maxLengthStart = null;
		}

		// remove outer {}
		text = outerText.substr(1, outerText.length - 2);
		for (index = 0; index < text.length; index += chr.length) {
			chr = pctEncoder.pctCharAt(text, index);
			if (index === 0) {
				operator = operators.valueOf(chr);
				if (operator.symbol !== '') {
					// first char is operator symbol. so we can continue
					varnameStart = 1;
					continue;
				}
				// the first char was a regular varname char. We have simple strings and must go on.
				varnameStart = 0;
			}
			if (varnameStart !== null) {

				// the spec says: varname       =  varchar *( ["."] varchar )
				// so a dot is allowed except for the first char
				if (chr === '.') {
					if (varnameStart === index) {
						throw new Error('a varname MUST NOT start with a dot -- see position ' + index);
					}
					continue;
				}
				if (isVarchar(chr)) {
					continue;
				}
				closeVarname();
			}
			if (maxLengthStart !== null) {
				if (isDigit(chr)) {
					continue;
				}
				closeMaxLength();
			}
			if (chr === ':') {
				if (varspec.maxLength !== null) {
					throw new Error('only one :maxLength is allowed per varspec at position ' + index);
				}
				maxLengthStart = index + 1;
				continue;
			}
			if (chr === '*') {
				if (varspec === null) {
					throw new Error('explode exploded at position ' + index);
				}
				if (varspec.exploded) {
					throw new Error('explode exploded twice at position ' + index);
				}
				if (varspec.maxLength) {
					throw new Error('an explode (*) MUST NOT follow to a prefix, see position ' + index);
				}
				varspec.exploded = true;
				continue;
			}
			// the only legal character now is the comma
			if (chr === ',') {
				varspecs.push(varspec);
				varspec = null;
				varnameStart = index + 1;
				continue;
			}
			throw new Error("illegal character '" + chr + "' at position " + index);
		} // for chr
		if (varnameStart !== null) {
			closeVarname();
		}
		if (maxLengthStart !== null) {
			closeMaxLength();
		}
		varspecs.push(varspec);
		return new VariableExpression(outerText, operator, varspecs);
	}

	UriTemplate.parse = function parse(uriTemplateText) {
		// assert filled string
		var
			index,
			chr,
			expressions = [],
			braceOpenIndex = null,
			literalStart = 0;
		for (index = 0; index < uriTemplateText.length; index += 1) {
			chr = uriTemplateText.charAt(index);
			if (literalStart !== null) {
				if (chr === '}') {
					throw new Error('brace was closed in position ' + index + " but never opened");
				}
				if (chr === '{') {
					if (literalStart < index) {
						expressions.push(new LiteralExpression(uriTemplateText.substring(literalStart, index)));
					}
					literalStart = null;
					braceOpenIndex = index;
				}
				continue;
			}

			if (braceOpenIndex !== null) {
				// here just { is forbidden
				if (chr === '{') {
					throw new Error('brace was opened in position ' + braceOpenIndex + " and cannot be reopened in position " + index);
				}
				if (chr === '}') {
					if (braceOpenIndex + 1 === index) {
						throw new Error("empty braces on position " + braceOpenIndex);
					}
					expressions.push(parseExpression(uriTemplateText.substring(braceOpenIndex, index + 1)));
					braceOpenIndex = null;
					literalStart = index + 1;
				}
				continue;
			}
			throw new Error('reached unreachable code');
		}
		if (braceOpenIndex !== null) {
			throw new Error("brace was opened on position " + braceOpenIndex + ", but never closed");
		}
		if (literalStart < uriTemplateText.length) {
			expressions.push(new LiteralExpression(uriTemplateText.substr(literalStart)));
		}
		return new UriTemplate(uriTemplateText, expressions);
	};

	local.http.UriTemplate = UriTemplate;
})();// Navigator
// =========

function getEnvironmentHost() {
	if (typeof window !== 'undefined') return window.location.host;
	if (app) return app.config.environmentHost; // must be passed to in the ready config
	return '';
}

// navigator sugar functions
// =========================
// these constants specify which sugars to add to the navigator
var NAV_REQUEST_FNS = ['head',/*'get',*/'post','put','patch','delete']; // get is added separately
var NAV_GET_TYPES = {
	'Json':'application/json','Html':'text/html','Xml':'text/xml',
	'Events':'text/event-stream','Eventstream':'text/event-stream',
	'Plain':'text/plain', 'Text':'text/plain'
};
// http://www.iana.org/assignments/link-relations/link-relations.xml
// (I've commented out the relations which are probably not useful enough to make sugars for)
var NAV_RELATION_FNS = [
	'alternate', /*'appendix', 'archives',*/ 'author', /*'bookmark', 'canonical', 'chapter',*/ 'collection',
	/*'contents', 'copyright',*/ 'current', 'describedby', /*'disclosure', 'duplicate', 'edit', 'edit-media',
	'enclosure',*/ 'first', /*'glossary', 'help', 'hosts', 'hub', 'icon',*/ 'index', 'item', 'last',
	'latest-version', /*'license', 'lrdd',*/ 'monitor', 'monitor-group', 'next', 'next-archive', /*'nofollow',
	'noreferrer',*/ 'payment', 'predecessor-version', /*'prefetch',*/ 'prev', /*'previous',*/ 'prev-archive',
	'related', 'replies', 'search',	/*'section',*/ 'self', 'service', /*'start', 'stylesheet', 'subsection',*/
	'successor-version', /*'tag',*/ 'up', 'version-history', 'via', 'working-copy', 'working-copy-of'
];

// NavigatorContext
// ================
// INTERNAL
// information about the resource that a navigator targets
//  - may exist in an "unresolved" state until the URI is confirmed by a response from the server
//  - may exist in a "bad" state if an attempt to resolve the link failed
//  - may be "relative" if described by a relation from another context
//  - may be "absolute" if described by a URI
// :NOTE: absolute contexts may have a URI without being resolved, so don't take the presence of a URI as a sign that the resource exists
function NavigatorContext(rel, relparams, url) {
	this.rel          = rel;
	this.relparams    = relparams;
	this.url          = url;

	this.resolveState = NavigatorContext.UNRESOLVED;
	this.error        = null;
}
NavigatorContext.UNRESOLVED = 0;
NavigatorContext.RESOLVED   = 1;
NavigatorContext.FAILED     = 2;
NavigatorContext.prototype.isResolved = function() { return this.resolveState === NavigatorContext.RESOLVED; };
NavigatorContext.prototype.isBad      = function() { return this.resolveState > 1; };
NavigatorContext.prototype.isRelative = function() { return (!this.url && !!this.rel); };
NavigatorContext.prototype.isAbsolute = function() { return (!!this.url); };
NavigatorContext.prototype.getUrl     = function() { return this.url; };
NavigatorContext.prototype.getError   = function() { return this.error; };
NavigatorContext.prototype.getHost    = function() {
	if (!this.host) {
		if (!this.url) { return null; }
		var urld  = local.http.parseUri(this.url);
		this.host = (urld.protocol || 'http') + '://' + (urld.authority || getEnvironmentHost());
	}
	return this.host;
};
NavigatorContext.prototype.resetResolvedState = function() {
	this.resolveState = NavigatorContext.UNRESOLVED;
	this.error = null;
};
NavigatorContext.prototype.resolve    = function(url) {
	this.error        = null;
	this.resolveState = NavigatorContext.RESOLVED;
	this.url          = url;
	var urld          = local.http.parseUri(this.url);
	this.host         = (urld.protocol || 'http') + '://' + urld.authority;
};

// Navigator
// =========
// EXPORTED
// API to follow resource links (as specified by the response Link header)
//  - uses the rel attribute to type its navigations
//  - uses URI templates to generate URIs
//  - queues link navigations until a request is made, to decrease on the amount of async calls required
//
// example usage:
/*
var github = new Navigator('https://api.github.com');
var me = github.collection('users').item('pfraze');

me.getJson()
	// -> HEAD https://api.github.com
	// -> HEAD https://api.github.com/users
	// -> GET  https://api.github.com/users/pfraze
	.then(function(myData, headers, status) {
		myData.email = 'pfrazee@gmail.com';
		me.put(myData);
		// -> PUT https://api.github.com/users/pfraze { email:'pfrazee@gmail.com', ...}

		github.collection('users', { since:profile.id }).getJson(function(usersData) {
			// -> GET https://api.github.com/users?since=123
			//...
		});
	});
*/
function Navigator(context, parentNavigator) {
	this.context         = context         || null;
	this.parentNavigator = parentNavigator || null;
	this.links           = null;

	// were we passed a url?
	if (typeof this.context == 'string') {
		// absolute context
		this.context = new NavigatorContext(null, null, context);
	} else {
		// relative context
		if (!parentNavigator)
			throw "parentNavigator is required for navigators with relative contexts";
	}
}
local.http.Navigator = Navigator;

// executes an HTTP request to our context
//  - uses additional parameters on the request options:
//    - retry: bool, should the url resolve be tried if it previously failed?
//    - noresolve: bool, should we use the url we have and not try to resolve one from our parent's links?
Navigator.prototype.dispatch = function Navigator__dispatch(req) {
	if (!req || !req.method) { throw "request options not provided"; }
	var self = this;

	var response = local.promise();
	((req.noresolve) ? local.promise(this.context.getUrl()) : this.resolve({ retry:req.retry, nohead:true }))
		.succeed(function(url) {
			req.url = url;
			return local.http.dispatch(req);
		})
		.succeed(function(res) {
			self.context.error = null;
			self.context.resolveState = NavigatorContext.RESOLVED;
			if (res.headers.link)
				self.links = res.headers.link;
			else
				self.links = self.links || []; // cache an empty link list so we dont keep trying during resolution
			return res;
		})
		.fail(function(res) {
			if (res.status === 404) {
				self.context.error = res;
				self.context.resolveState = NavigatorContext.FAILED;
			}
			throw res;
		})
		.chain(response);
	return response;
};

// executes a GET text/event-stream request to our context
Navigator.prototype.subscribe = function Navigator__dispatch() {
	return this.resolve()
		.succeed(function(url) {
			return local.http.subscribe(url);
		});
};

// follows a link relation from our context, generating a new navigator
//  - uses URI Templates to generate links
//  - first looks for a matching rel and title
//    eg relation('item', 'foobar'), Link: <http://example.com/some/foobar>; rel="item"; title="foobar" -> http://example.com/some/foobar
//  - then looks for a matching rel with no title and uses that to generate the link
//    eg relation('item', 'foobar'), Link: <http://example.com/some/{title}>; rel="item" -> http://example.com/some/foobar
//  - `extraParams` are any other URI template substitutions which should occur
//    eg relation('item', 'foobar', { limit:5 }), Link: <http://example.com/some/{item}{?limit}>; rel="item" -> http://example.com/some/foobar?limit=5
Navigator.prototype.relation = function Navigator__relation(rel, title, extraParams) {
	var params = extraParams || {};
	params['title'] = (title || '').toLowerCase();

	return new Navigator(new NavigatorContext(rel, params), this);
};

// resolves the navigator's URL, reporting failure if a link or resource is unfound
//  - also ensures the links have been retrieved from the context
//  - may trigger resolution of parent contexts
//  - options is optional and may include:
//    - retry: bool, should the resolve be tried if it previously failed?
//    - nohead: bool, should we issue a HEAD request once we have a URL? (not favorable if planning to dispatch something else)
//  - returns a promise
Navigator.prototype.resolve = function Navigator__resolve(options) {
	var self = this;
	options = options || {};

	var nohead = options.nohead;
	delete options.nohead; // pull it out so that parent resolves do their head requests

	var resolvePromise = local.promise();
	if (this.links !== null && (this.context.isResolved() || (this.context.isAbsolute() && this.context.isBad() === false)))
		resolvePromise.fulfill(this.context.getUrl());
	else if (this.context.isBad() === false || (this.context.isBad() && options.retry)) {
		this.context.resetResolvedState();
		if (this.parentNavigator)
			this.parentNavigator.__resolveChild(this, options)// lookup link in parent navigator
				.succeed(function(url) {
					if (nohead)
						return true;
					// send HEAD request for links
					return self.head(null, null, null, { noresolve:true });
				})
				.succeed(function(res) { return self.context.getUrl(); })
				.chain(resolvePromise);
		else
			((nohead) ? local.promise(true) : this.head(null, null, null, { noresolve:true })) // head request to our absolute url to confirm it
				.succeed(function(res) { return self.context.getUrl(); })
				.chain(resolvePromise);
	} else
		resolvePromise.reject(this.context.getError());
	return resolvePromise;
};

// resolves a child navigator's context relative to our own
//  - may trigger resolution of parent contexts
//  - options is optional and may include:
//    - retry: bool, should the resolve be tried if it previously failed?
//  - returns a promise
Navigator.prototype.__resolveChild = function Navigator__resolveChild(childNav, options) {
	var self = this;
	var resolvedPromise = local.promise();

	// resolve self before resolving child
	this.resolve(options).then(
		function() {
			var childUrl = self.__lookupLink(childNav.context);
			if (childUrl) {
				childNav.context.resolve(childUrl);
				resolvedPromise.fulfill(childUrl);
			} else {
				var response = new local.http.ClientResponse(404, 'link relation not found');
				resolvedPromise.reject(response);
				response.end();
			}
		},
		function(error) {
			// we're bad, and all children are bad as well
			childNav.context.error = error;
			childNav.context.resolveState = NavigatorContext.FAILED;
			resolvedPromise.reject(error);
			return error;
		}
	);

	return resolvedPromise;
};

// looks up a link in the cache and generates the URI
//  - first looks for a matching rel and title
//    eg item('foobar') -> Link: <http://example.com/some/foobar>; rel="item"; title="foobar" -> http://example.com/some/foobar
//  - then looks for a matching rel with no title and uses that to generate the link
//    eg item('foobar') -> Link: <http://example.com/some/{item}>; rel="item" -> http://example.com/some/foobar
Navigator.prototype.__lookupLink = function Navigator__lookupLink(context) {
	// try to find the link with a title equal to the param we were given
	var href = local.http.lookupLink(this.links, context.rel, context.relparams.title);

	if (href) {
		var url = local.http.UriTemplate.parse(href).expand(context.relparams);
		var urld = local.http.parseUri(url);
		if (!urld.host) // handle relative URLs
			url = this.context.getHost() + urld.relative;
		return url;
	}
	console.log('Failed to find a link to resolve context. Target link:', context.rel, context.relparams, 'Navigator:', this);
	return null;
};

// add navigator dispatch sugars
NAV_REQUEST_FNS.forEach(function (m) {
	Navigator.prototype[m] = function(body, type, headers, options) {
		var req = options || {};
		req.headers = headers || {};
		req.method = m;
		if (body !== null && typeof body != 'null' && /head/i.test(m) === false)
			req.headers['content-type'] = type || (typeof body == 'object' ? 'application/json' : 'text/plain');
		req.body = body;
		return this.dispatch(req);
	};
});

// add get sugar
Navigator.prototype.get = function(type, headers, options) {
	var req = options || {};
	req.headers = headers || {};
	req.method = 'get';
	req.headers.accept = type;
	return this.dispatch(req);
};

// add get* request sugars
for (var t in NAV_GET_TYPES) {
	(function(t, mimetype) {
		Navigator.prototype['get'+t] = function(headers, options) {
			return this.get(mimetype, headers, options);
		};
	})(t, NAV_GET_TYPES[t]);
}

// add navigator relation sugars
NAV_RELATION_FNS.forEach(function (r) {
	var safe_r = r.replace(/-/g, '_');
	Navigator.prototype[safe_r] = function(param, extra) {
		return this.relation(r, param, extra);
	};
});

// builder fn
local.http.navigator = function(url) {
	return (url instanceof Navigator) ? url : new Navigator(url);
};})();