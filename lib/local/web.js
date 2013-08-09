// Local HTTP
// ==========
// pfraze 2013

if (typeof this.local == 'undefined')
	this.local = {};
if (typeof this.local.web == 'undefined')
	this.local.web = {};

(function() {
	function noop() {}
// Local status codes
// ==================
// used to specify client operation states

// link query failed to match
local.web.LINK_NOT_FOUND = 1;// Helpers
// =======

// EXPORTED
// breaks a link header into a javascript object
local.web.parseLinkHeader = function parseLinkHeader(headerStr) {
	if (typeof headerStr !== 'string') {
		return headerStr;
	}
	// '</foo/bar>; rel="baz"; id="blah", </foo/bar>; rel="baz"; id="blah", </foo/bar>; rel="baz"; id="blah"'
	return headerStr.split(/,[\s]*/g).map(function(linkStr) {
		// ['</foo/bar>; rel="baz"; id="blah"', '</foo/bar>; rel="baz"; id="blah"']
		var link = {};
		linkStr.split(/\s*;\s*/g).forEach(function(attrStr) {
			// ['</foo/bar>', 'rel="baz"', 'id="blah"']
			if (!attrStr) { return; }
			if (attrStr.charAt(0) === '<') {
				// '</foo/bar>'
				link.href = attrStr.trim().slice(1, -1);
			} else {
				var attrParts = attrStr.split(/\s*=\s*/g);
				if (attrParts[1]) {
					// ['rel', '"baz"'] or ['rel', 'baz']
					var k = attrParts[0];
					var v = attrParts[1].replace(/^"|"$/g, '');
					link[k] = v;
				} else {
					// ['attr']
					var k = attrParts[0];
					link[k] = true;
				}
			}
		});
		return link;
	});
};

// EXPORTED
// takes parsed a link header and a query object, produces an array of matching links
// - `links`: [object]/object, either the parsed array of links or the request/response object
local.web.queryLinks = function queryLinks(links, query) {
	if (!links) return [];
	if (links.headers) links = links.headers.link; // actually a request or response object
	if (!Array.isArray(links)) return [];
	return links.filter(function(link) { return local.web.queryLink(link, query); });
};

// EXPORTED
// gives the first result from queryLinks
local.web.queryLinks1 = function queryLinks1(links, query) {
	var matches = local.web.queryLinks(links, query);
	return matches[0];
};

// EXPORTED
// takes parsed link and a query object, produces a boolean `isMatch`
// - `query`: object, keys are attributes to test, values are values to test against (strings)
//            eg { rel: 'foo bar', id: 'x' }
// - Query rules
//   - rel: can take multiple values, space-separated, which are ANDed logically
//   - rel: will ignore the preceding scheme and trailing slash on URI values
//   - rel: items preceded by an exclamation-point will invert (logical NOT)
local.web.queryLink = function queryLink(link, query) {
	for (var attr in query) {
		if (attr == 'rel') {
			var terms = query.rel.split(/\s+/);
			for (var i=0; i < terms.length; i++) {
				var desiredBool = true;
				if (terms[i].charAt(0) == '!') {
					terms[i] = terms[i].slice(1);
					desiredBool = false;
				}
				if (RegExp('(\\s|^)(.*//)?'+terms[i]+'(\\s|$)', 'i').test(link.rel) !== desiredBool)
					return false;
			}
		}
		else {
			if (link[attr] != query[attr])
				return false;
		}
	}
	return true;
};

// <https://github.com/federomero/negotiator>
// for to ^ for the content negotation helpers below

// EXPORTED
// breaks an accept header into a javascript object
// - `accept`: string, the accept header
local.web.parseAcceptHeader = function parseAcceptHeader(accept) {
	return accept.split(',')
		.map(function(e) { return parseMediaType(e.trim()); })
		.filter(function(e) { return e && e.q > 0; });
};

// INTERNAL
function parseMediaType(s) {
	var match = s.match(/\s*(\S+)\/([^;\s]+)\s*(?:;(.*))?/);
	if (!match) return null;

	var type = match[1];
	var subtype = match[2];
	var full = "" + type + "/" + subtype;
	var params = {}, q = 1;

	if (match[3]) {
		params = match[3].split(';')
			.map(function(s) { return s.trim().split('='); })
			.reduce(function (set, p) { set[p[0]] = p[1]; return set; }, params);

		if (params.q !== null) {
			q = parseFloat(params.q);
			delete params.q;
		}
	}

	return {
		type: type,
		subtype: subtype,
		params: params,
		q: q,
		full: full
	};
}

// INTERNAL
function getMediaTypePriority(type, accepted) {
	var matches = accepted
		.filter(function(a) { return specify(type, a); })
		.sort(function (a, b) { return a.q > b.q ? -1 : 1; }); // revsort
	return matches[0] ? matches[0].q : 0;
}

// INTERNAL
function specifies(spec, type) {
	return spec === '*' || spec === type;
}

// INTERNAL
function specify(type, spec) {
	var p = parseMediaType(type);

	if (spec.params) {
		var keys = Object.keys(spec.params);
		if (keys.some(function (k) { return !specifies(spec.params[k], p.params[k]); })) {
			// some didn't specify.
			return null;
		}
	}

	if (specifies(spec.type, p.type) && specifies(spec.subtype, p.subtype)) {
		return spec;
	}
}

// EXPORTED
// returns an array of preferred media types ordered by priority from a list of available media types
// - `accept`: string/object, given accept header or request object
// - `provided`: optional [string], allowed media types
local.web.preferredTypes = function preferredTypes(accept, provided) {
	if (typeof accept == 'object')
		accept = accept.headers.accept;
	accept = local.web.parseAcceptHeader(accept || '');
	if (provided) {
		return provided
			.map(function(type) { return [type, getMediaTypePriority(type, accept)]; })
			.filter(function(pair) { return pair[1] > 0; })
			.sort(function(a, b) { return a[1] === b[1] ? 0 : a[1] > b[1] ? -1 : 1; }) // revsort
			.map(function(pair) { return pair[0]; });
	}
	return accept.map(function(type) { return type.full; });
};

// EXPORTED
// returns the top preferred media type from a list of available media types
// - `accept`: string/object, given accept header or request object
// - `provided`: optional [string], allowed media types
local.web.preferredType = function preferredType(accept, provided) {
	return local.web.preferredTypes(accept, provided)[0];
};
// </https://github.com/federomero/negotiator>

// EXPORTED
// correctly joins together all url segments given in the arguments
// eg joinUrl('/foo/', '/bar', '/baz/') -> '/foo/bar/baz/'
local.web.joinUrl = function joinUrl() {
	var parts = Array.prototype.map.call(arguments, function(arg, i) {
		arg = ''+arg;
		var lo = 0, hi = arg.length;
		if (arg == '/') return '';
		if (i !== 0 && arg.charAt(0) === '/') { lo += 1; }
		if (arg.charAt(hi - 1) === '/') { hi -= 1; }
		return arg.substring(lo, hi);
	});
	return parts.join('/');
};

// EXPORTED
// tests to see if a URL is absolute
// - the heuristic here is, does it have a //?
// - the following are seen as relative URLs:
//   - foobar.com
//   - /foo/bar
//   - rel:||foobar
//   - rel:foo.com||bar
// - the following are seen as absolute URLs:
//   - http://foobar.com
//   - //foobar.com
//   - rel:http://foo.com||bar
var isAbsUriRE = /\/\//;
local.web.isAbsUri = function(v) {
	return isAbsUriRE.test(v);
};

// EXPORTED
// tests to see if a URL is using the rel scheme
var isRelSchemeUriRE = /\|\||rel:/;
local.web.isRelSchemeUri = function(v) {
	return isRelSchemeUriRE.test(v);
};


// EXPORTED
// takes a context url and a relative path and forms a new valid url
// eg joinRelPath('http://grimwire.com/foo/bar', '../fuz/bar') -> 'http://grimwire.com/foo/fuz/bar'
local.web.joinRelPath = function(urld, relpath) {
	if (typeof urld == 'string')
		urld = local.web.parseUri(urld);
	if (relpath.charAt(0) == '/')
		// "absolute" relative, easy stuff
		return urld.protocol + '://' + urld.authority + relpath;
	// totally relative, oh god
	// (thanks to geoff parker for this)
	var hostpath = urld.path;
	var hostpathParts = hostpath.split('/');
	var relpathParts = relpath.split('/');
	for (var i=0, ii=relpathParts.length; i < ii; i++) {
		if (relpathParts[i] == '.')
			continue; // noop
		if (relpathParts[i] == '..')
			hostpathParts.pop();
		else
			hostpathParts.push(relpathParts[i]);
	}
	return local.web.joinUrl(urld.protocol + '://' + urld.authority, hostpathParts.join('/'));
};

// EXPORTED
// parseUri 1.2.2, (c) Steven Levithan <stevenlevithan.com>, MIT License
local.web.parseUri = function parseUri(str) {
	if (typeof str === 'object') {
		if (str.url) { str = str.url; }
		else if (str.host || str.path) { str = local.web.joinUrl(req.host, req.path); }
	}

	// handle data-uris specially - performance characteristics are much different
	if (str.slice(0,5) == 'data:') {
		return { protocol: 'data', source: str };
	}

	var	o   = local.web.parseUri.options,
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

local.web.parseUri.options = {
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

// EXPORTED
// Converts a 'rel:' URI into an array of http/s/l URIs and link query objects
local.web.parseRelUri = function(str) {
	if (!str) return [];

	// Split into navigations
	var parts = str.split('||');

	// First entry - starting URL
	// eg rel:http://foo.com||...
	if (parts[0]) {
		// Drop the scheme
		if (parts[0].indexOf('rel:') === 0)
			parts[0] = parts[0].slice(4);
	}

	// Remaining entries - queries
	// eg ...||rel=id,attr1=value1,attr2=value2||...
	for (var i=1; i < parts.length; i++) {
		var query = {};
		var attrs = parts[i].split(',');
		for (var j=0; j < attrs.length; j++) {
			var kv = attrs[j].split('=');
			if (j === 0) {
				query.rel = kv[0].replace(/\+/, ' ');
				if (kv[1])
					query.id = kv[1];
			} else
				query[kv[0]] = decodeURIComponent(kv[1]).replace(/\+/, ' ');
		}
		parts[i] = query;
	}

	// Drop first entry if empty
	if (!parts[0])
		parts.shift();

	return parts;
};

// sends the given response back verbatim
// - if `writeHead` has been previously called, it will not change
// - params:
//   - `target`: the response to populate
//   - `source`: the response to pull data from
//   - `headersCb`: (optional) takes `(headers)` from source and responds updated headers for target
//   - `bodyCb`: (optional) takes `(body)` from source and responds updated body for target
local.web.pipe = function(target, source, headersCB, bodyCb) {
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
local.web.contentTypes = contentTypes;

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
	try {
		return fn(str);
	} catch (e) {
		console.warn('Failed to deserialize content', type, str);
		return str;
	}
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
local.web.contentTypes.register('application/json',
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
local.web.contentTypes.register('application/x-www-form-urlencoded',
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
);
local.web.contentTypes.register('text/event-stream',
	function (obj) {
		if (typeof obj.data != 'undefined')
			return "event: "+obj.event+"\r\ndata: "+JSON.stringify(obj.data)+"\r\n\r\n";
		return "event: "+obj.event+"\r\n\r\n";
	},
	function (str) {
		var m = {};
		str.split("\r\n").forEach(function(kv) {
			if (/^[\s]*$/.test(kv))
				return;
			kv = splitEventstreamKV(kv);
			if (!kv[0]) return; // comment lines have nothing before the colon
			m[kv[0]] = kv[1];
		});
		try { m.data = JSON.parse(m.data); }
		catch(e) {}
		return m;
	}
);
function splitEventstreamKV(kv) {
	var i = kv.indexOf(':');
	return [kv.slice(0, i).trim(), kv.slice(i+1).trim()];
}// Request
// =======
// EXPORTED
// Interface for sending requests
function Request(options) {
	local.util.EventEmitter.call(this);

	if (!options) options = {};
	if (typeof options == 'string')
		options = { url: options };

	this.method = options.method ? options.method.toUpperCase() : 'GET';
	this.url = options.url || null;
	this.query = options.query || {};
	this.headers = options.headers || {};
	this.body = '';

	// non-enumerables (dont include in request messages)
	Object.defineProperty(this, 'body', {
		value: '',
		configurable: true,
		enumerable: false,
		writable: true
	});
	Object.defineProperty(this, 'stream', {
		value: options.stream || false,
		configurable: true,
		enumerable: false,
		writable: true
	});
	Object.defineProperty(this, 'binary', {
		value: options.binary || false,
		configurable: true,
		enumerable: false,
		writable: true
	});
	Object.defineProperty(this, 'isConnOpen', {
		value: true,
		configurable: true,
		enumerable: false,
		writable: true
	});

	// request buffering
	Object.defineProperty(this, 'body_', {
		value: local.promise(),
		configurable: true,
		enumerable: false,
		writable: false
	});
	(function buffer(self) {
		self.on('data', function(data) { self.body += data; });
		self.on('end', function() {
			if (self.headers['content-type'])
				self.body = local.web.contentTypes.deserialize(self.body, self.headers['content-type']);
			self.body_.fulfill(self.body);
		});
	})(this);
}
local.web.Request = Request;
Request.prototype = Object.create(local.util.EventEmitter.prototype);

Request.prototype.setHeader    = function(k, v) { this.headers[k] = v; };
Request.prototype.getHeader    = function(k) { return this.headers[k]; };
Request.prototype.removeHeader = function(k) { delete this.headers[k]; };

// causes the request/response to abort after the given milliseconds
Request.prototype.setTimeout = function(ms) {
	var self = this;
	setTimeout(function() {
		if (self.isConnOpen) self.close();
	}, ms);
};

// EXPORTED
// converts any known header objects into their string versions
// - used on remote connections
Request.prototype.serializeHeaders = function(headers) {
	if (this.headers.authorization && typeof this.headers.authorization == 'object') {
		if (!this.headers.authorization.scheme) { throw "`scheme` required for auth headers"; }
		var auth;
		switch (this.headers.authorization.scheme.toLowerCase()) {
			case 'basic':
				auth = 'Basic '+btoa(this.headers.authorization.name+':'+this.headers.authorization.password);
				break;
			case 'persona':
				auth = 'Persona name='+this.headers.authorization.name+' assertion='+this.headers.authorization.assertion;
				break;
			default:
				throw "unknown auth sceme: "+this.headers.authorization.scheme;
		}
		this.headers.authorization = auth;
	}
	if (this.headers.via && typeof this.headers.via == 'object') {
		var via = this.headers.via;
		if (!Array.isArray(via)) via = [via];
		this.headers.via = via.map(function(v) {
			return [
				((v.protocol.name) ? (v.protocol.name + '/') : '') + v.protocol.version,
				v.host,
				((v.comment) ? v.comment : '')
			].join(' ');
		}).join(', ');
	}
};

// sends data over the stream
// - emits the 'data' event
Request.prototype.write = function(data) {
	if (!this.isConnOpen)
		return;
	if (typeof data != 'string')
		data = local.web.contentTypes.serialize(data, this.headers['content-type']);
	this.emit('data', data);
};

// ends the request stream
// - `data`: optional mixed, to write before ending
// - emits 'end' and 'close' events
Request.prototype.end = function(data) {
	if (!this.isConnOpen)
		return;
	if (typeof data != 'undefined')
		this.write(data);
	this.emit('end');
	// this.close();
	// ^ do not close - the response should close
};

// closes the stream, aborting if not yet finished
// - emits 'close' event
Request.prototype.close = function() {
	if (!this.isConnOpen)
		return;
	this.isConnOpen = false;
	this.emit('close');

	// :TODO: when events are suspended, this can cause problems
	//        maybe put these "removes" in a 'close' listener?
	// this.removeAllListeners('data');
	// this.removeAllListeners('end');
	// this.removeAllListeners('close');
};// Response
// ========
// EXPORTED
// Interface for receiving responses
// - usually created internally and returned by `dispatch`
function Response() {
	local.util.EventEmitter.call(this);

	this.status = 0;
	this.reason = null;
	this.headers = {};
	this.body = '';

	// non-enumerables (dont include in response messages)
	Object.defineProperty(this, 'isConnOpen', {
		value: true,
		configurable: true,
		enumerable: false,
		writable: true
	});

	// response buffering
	Object.defineProperty(this, 'body_', {
		value: local.promise(),
		configurable: true,
		enumerable: false,
		writable: false
	});
	(function buffer(self) {
		self.on('data', function(data) { 
			if (data instanceof ArrayBuffer)
				self.body = data; // browsers buffer binary responses, so dont try to stream
			else
				self.body += data;
		});
		self.on('end', function() {
			if (self.headers['content-type'])
				self.body = local.web.contentTypes.deserialize(self.body, self.headers['content-type']);
			self.body_.fulfill(self.body);
		});
	})(this);
}
local.web.Response = Response;
Response.prototype = Object.create(local.util.EventEmitter.prototype);

Response.prototype.setHeader    = function(k, v) { this.headers[k] = v; };
Response.prototype.getHeader    = function(k) { return this.headers[k]; };
Response.prototype.removeHeader = function(k) { delete this.headers[k]; };

// writes the header to the response
// - emits the 'headers' event
Response.prototype.writeHead = function(status, reason, headers) {
	this.status = status;
	this.reason = reason;
	if (headers) {
		for (var k in headers) {
			if (headers.hasOwnProperty(k))
				this.setHeader(k, headers[k]);
		}
	}

	this.emit('headers', this);
	return this;
};

// sends data over the stream
// - emits the 'data' event
Response.prototype.write = function(data) {
	if (!this.isConnOpen)
		return;
	if (typeof data != 'string')
		data = local.web.contentTypes.serialize(data, this.headers['content-type']);
	this.emit('data', data);
};

// ends the response stream
// - `data`: optional mixed, to write before ending
// - emits 'end' and 'close' events
Response.prototype.end = function(data) {
	if (!this.isConnOpen)
		return;
	if (typeof data != 'undefined')
		this.write(data);
	this.emit('end');
	this.close();
};

// closes the stream, aborting if not yet finished
// - emits 'close' event
Response.prototype.close = function() {
	if (!this.isConnOpen)
		return;
	this.isConnOpen = false;
	this.emit('close');
	
	// :TODO: when events are suspended, this can cause problems
	//        maybe put these "removes" in a 'close' listener?
	// this.removeAllListeners('headers');
	// this.removeAllListeners('data');
	// this.removeAllListeners('end');
	// this.removeAllListeners('close');
};// schemes
// =======
// EXPORTED
// dispatch() handlers, matched to the scheme in the request URIs
var schemes = {
	register: schemes__register,
	unregister: schemes__unregister,
	get: schemes__get
};
var schemes__registry = {};
local.web.schemes = schemes;

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
local.web.schemes.register(['http', 'https'], function(request, response) {
	// parse URL
	var urld = local.web.parseUri(request.url);

	// if a query was given in the options, mix it into the urld
	if (request.query) {
		var q = local.web.contentTypes.serialize(request.query, 'application/x-www-form-urlencoded');
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
	var url = ((urld.protocol) ? (urld.protocol + '://') : '') + urld.authority + urld.relative;

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
		if (xhrRequest.readyState !== XMLHttpRequest.DONE)
			xhrRequest.abort();
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
						headers[kv[0].toLowerCase()] = kv[1];
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

				// parse any headers we use often
				if (headers.link)
					headers.link = local.web.parseLinkHeader(headers.link);
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
			if (response.status !== 0 && xhrRequest.status === 0) {
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
local.web.schemes.register('httpl', function(request, response) {
	var urld = local.web.parseUri(request.url);

	// need additional time to get the worker wired up
	request.suspendEvents();
	response.suspendEvents();

	// find the local server
	var server = local.web.getLocal(urld.host);
	if (!server)
		server = localNotFoundServer;

	// pull out and standardize the path
	request.path = urld.path;
	if (!request.path) request.path = '/'; // no path, give a '/'
	else request.path = request.path.replace(/(.)\/$/, '$1'); // otherwise, never end with a '/'

	// if the urld has query parameters, mix them into the request's query object
	if (urld.query) {
		var q = local.web.contentTypes.deserialize(urld.query, 'application/x-www-form-urlencoded');
		for (var k in q)
			request.query[k] = q[k];
	}

	// support warnings
	if (request.binary)
		console.warn('Got HTTPL request with binary=true - sorry, not currently supported', request);

	// pass on to the server (async)
	setTimeout(function() {
		server.fn.call(server.context, request, response);
		request.resumeEvents();
		response.resumeEvents();
	}, 0);
});


// Data
// ====
local.web.schemes.register('data', function(request, response) {
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
	setTimeout(function() {
		response.writeHead(200, 'ok', {'content-type': contentType});
		response.end(data);
	});
});


// Local Server Registry
// =====================
var __httpl_registry = {};

// EXPORTED
local.web.registerLocal = function registerLocal(domain, server, serverContext) {
	var urld = local.web.parseUri(domain);
	if (urld.protocol && urld.protocol !== 'httpl') throw "registerLocal can only add servers to the httpl protocol";
	if (!urld.host) throw "invalid domain provided to registerLocal";
	if (__httpl_registry[urld.host]) throw "server already registered at domain given to registerLocal";
	__httpl_registry[urld.host] = { fn: server, context: serverContext };
};

// EXPORTED
local.web.unregisterLocal = function unregisterLocal(domain) {
	var urld = local.web.parseUri(domain);
	if (!urld.host) {
		throw "invalid domain provided toun registerLocal";
	}
	if (__httpl_registry[urld.host]) {
		delete __httpl_registry[urld.host];
	}
};

// EXPORTED
local.web.getLocal = function getLocal(domain) {
	var urld = local.web.parseUri(domain);
	if (!urld.host) {
		throw "invalid domain provided toun registerLocal";
	}
	return __httpl_registry[urld.host];
};

// EXPORTED
local.web.getLocalRegistry = function getLocalRegistry() {
	return __httpl_registry;
};
var webDispatchWrapper;

// dispatch()
// ==========
// EXPORTED
// HTTP request dispatcher
// - `request` param:
//   - if string, creates GET request for json
//   - if object, requires `url`, sends immediately (so you cant stream request body)
//   - if Response, leaves you to run write() and end() (so you can stream request body)
// - `request.query`: optional object, additional query params
// - `request.headers`: optional object
// - `request.body`: optional request body
// - `request.stream`: optional boolean, stream the response? If falsey, will buffer and deserialize the response
// - `request.binary`: optional boolean, receive a binary arraybuffer response? Only applies to HTTP/S
// - returns a `Promise` object
//   - on success (status code 2xx), the promise is fulfilled with a `ClientResponse` object
//   - on failure (status code 4xx,5xx), the promise is rejected with a `ClientResponse` object
//   - all protocol (status code 1xx,3xx) is handled internally
local.web.dispatch = function dispatch(request) {
	if (!request) { throw "no request param provided to request"; }
	if (typeof request == 'string')
		request = { url: request };
	if (!request.url)
		throw "no url on request";

	// parse the url scheme
	var scheme, firstColonIndex = request.url.indexOf(':');
	if (firstColonIndex === -1)
		scheme = 'http'; // default for relative paths
	else
		scheme = request.url.slice(0, firstColonIndex);

	// if given a rel: scheme, spawn a navigator to handle it
	if (scheme == 'rel') {
		var url = request.url; delete request.url;
		return local.web.navigator(url).dispatch(request);
	}

	var response = new local.web.Response();

	// if not given a local.web.Request, make one and remember to end the request ourselves
	var body = null, selfEnd = false;
	if (!(request instanceof local.web.Request)) {
		body = request.body;
		request = new local.web.Request(request);
		selfEnd = true; // we're going to end()
	}

	// update link headers to be absolute
	response.on('headers', function() { processResponseHeaders(request, response); });

	// wire up the response with the promise
	var response_ = local.promise();
	if (request.stream) {
		// streaming, fulfill on 'headers'
		response.on('headers', function(response) {
			local.web.fulfillResponsePromise(response_, response);
		});
	} else {
		// buffering, fulfill on 'close'
		response.on('close', function() {
			local.web.fulfillResponsePromise(response_, response);
		});
	}

	// just until the scheme handler gets a chance to wire up
	// (allows async to occur in the webDispatchWrapper)
	request.suspendEvents();
	response.suspendEvents();

	// pull any extra arguments that may have been passed
	// form the paramlist: (request, response, dispatch, args...)
	var args = Array.prototype.slice.call(arguments, 1);
	args.unshift(function(request, response, schemeHandler) {
		// execute by scheme
		schemeHandler = schemeHandler || local.web.schemes.get(scheme);
		if (!schemeHandler) {
			response.writeHead(0, 'unsupported scheme "'+scheme+'"');
			response.end();
		} else {
			// dispatch according to scheme
			schemeHandler(request, response);
			// now that the scheme handler has wired up, the spice must flow
			request.resumeEvents();
			response.resumeEvents();
			// autosend request body if not given a local.web.Request `request`
			if (selfEnd) request.end(body);
		}
		return response_;
	});
	args.unshift(response);
	args.unshift(request);

	// allow the wrapper to audit the packet
	webDispatchWrapper.apply(null, args);

	response_.request = request;
	return response_;
};

// EXPORTED
// fulfills/reject a promise for a response with the given response
// - exported because its pretty useful
local.web.fulfillResponsePromise = function(promise, response) {
	// wasnt streaming, fulfill now that full response is collected
	if (response.status >= 200 && response.status < 400)
		promise.fulfill(response);
	else if (response.status >= 400 && response.status < 600 || response.status === 0)
		promise.reject(response);
	else
		promise.fulfill(response); // :TODO: 1xx protocol handling
};

local.web.setDispatchWrapper = function(wrapperFn) {
	webDispatchWrapper = wrapperFn;
};

local.web.setDispatchWrapper(function(request, response, dispatch) {
	dispatch(request, response);
});

// INTERNAL
// Helper to massage response values
var isUrlAbsoluteRE = /(:\/\/)|(^[-A-z0-9]*\.[-A-z0-9]*)/; // has :// or starts with ___.___
function processResponseHeaders(request, response) {
	if (response.headers.link) {
		response.headers.link.forEach(function(link) {
			if (isUrlAbsoluteRE.test(link.href) === false)
				link.href = local.web.joinRelPath(request.urld, link.href);
		});
	}
}// Events
// ======

// subscribe()
// ===========
// EXPORTED
// Establishes a connection and begins an event stream
// - sends a GET request with 'text/event-stream' as the Accept header
// - `request`: request object, formed as in `dispatch()`
// - returns a `EventStream` object
local.web.subscribe = function subscribe(request) {
	if (typeof request == 'string')
		request = { url: request };
	request.stream = true; // stream the response
	if (!request.method) request.method = 'GET';
	if (!request.headers) request.headers = { accept : 'text/event-stream' };
	if (!request.headers.accept) request.headers.accept = 'text/event-stream';

	var response_ = local.web.dispatch(request);
	return new EventStream(response_.request, response_);
};


// EventStream
// ===========
// EXPORTED
// provided by subscribe() to manage the events
function EventStream(request, response_) {
	local.util.EventEmitter.call(this);
	this.request = request;
	this.response = null;
	this.lastEventId = -1;
	this.isConnOpen = true;

	this.connect(response_);
}
local.web.EventStream = EventStream;
EventStream.prototype = Object.create(local.util.EventEmitter.prototype);
EventStream.prototype.connect = function(response_) {
	var self = this;
	response_.then(
		function(response) {
			self.isConnOpen = true;
			self.response = response;
			response.on('data', function(payload) {
				var events = payload.split("\r\n\r\n");
				events.forEach(function(event) {
					if (/^[\s]*$/.test(event)) return; // skip all whitespace
					emitEvent.call(self, event);
				});
			});
			response.on('end', function() { self.close(); });
			response.on('close', function() { if (self.isConnOpen) { self.isConnOpen = false; self.reconnect(); } });
			// ^ a close event should be predicated by an end(), giving us time to close ourselves
			//   if we get a close from the other side without an end message, we assume connection fault
		},
		function(response) {
			self.response = response;
			emitError.call(self, { event: 'error', data: response });
			self.close();
		}
	);
};
EventStream.prototype.reconnect = function() {
	if (this.isConnOpen)
		this.close();

	this.request = new local.web.Request(this.request);
	if (!this.request.headers) this.request.headers = {};
	if (this.lastEventId) this.request.headers['last-event-id'] = this.lastEventId;
	this.connect(local.web.dispatch(this.request));
	this.request.end();
};
EventStream.prototype.close = function() {
	this.isConnOpen = false;
	this.request.close();
	this.emit('close');
	this.removeAllListeners();
};
function emitError(e) {
	this.emit('message', e);
	this.emit('error', e);
}
function emitEvent(e) {
	e = local.web.contentTypes.deserialize(e, 'text/event-stream');
	var id = parseInt(e.id, 10);
	if (typeof id != 'undefined' && id > this.lastEventId)
		this.lastEventId = id;
	this.emit('message', e);
	this.emit(e.event, e);
}


// Broadcaster
// ===========
// EXPORTED
// a wrapper for event-streams
function Broadcaster() {
	this.streams = [];
}
local.web.Broadcaster = Broadcaster;

// listener management
Broadcaster.prototype.addStream = function(responseStream) {
	this.streams.push(responseStream);
	var self = this;
	responseStream.on('close', function() {
		self.endStream(responseStream);
	});
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
local.web.broadcaster = function() {
	return new Broadcaster();
};
/*
 UriTemplate Copyright (c) 2012-2013 Franz Antesberger. All Rights Reserved.
 Available via the MIT license.
*/

(function (exportCallback) {
    "use strict";

var UriTemplateError = (function () {

    function UriTemplateError (options) {
        this.options = options;
    }

    UriTemplateError.prototype.toString = function () {
        if (JSON && JSON.stringify) {
            return JSON.stringify(this.options);
        }
        else {
            return this.options;
        }
    };

    return UriTemplateError;
}());

var objectHelper = (function () {
    function isArray (value) {
        return Object.prototype.toString.apply(value) === '[object Array]';
    }

    function isString (value) {
        return Object.prototype.toString.apply(value) === '[object String]';
    }
    
    function isNumber (value) {
        return Object.prototype.toString.apply(value) === '[object Number]';
    }
    
    function isBoolean (value) {
        return Object.prototype.toString.apply(value) === '[object Boolean]';
    }
    
    function join (arr, separator) {
        var
            result = '',
            first = true,
            index;
        for (index = 0; index < arr.length; index += 1) {
            if (first) {
                first = false;
            }
            else {
                result += separator;
            }
            result += arr[index];
        }
        return result;
    }

    function map (arr, mapper) {
        var
            result = [],
            index = 0;
        for (; index < arr.length; index += 1) {
            result.push(mapper(arr[index]));
        }
        return result;
    }

    function filter (arr, predicate) {
        var
            result = [],
            index = 0;
        for (; index < arr.length; index += 1) {
            if (predicate(arr[index])) {
                result.push(arr[index]);
            }
        }
        return result;
    }

    function deepFreezeUsingObjectFreeze (object) {
        if (typeof object !== "object" || object === null) {
            return object;
        }
        Object.freeze(object);
        var property, propertyName;
        for (propertyName in object) {
            if (object.hasOwnProperty(propertyName)) {
                property = object[propertyName];
                // be aware, arrays are 'object', too
                if (typeof property === "object") {
                    deepFreeze(property);
                }
            }
        }
        return object;
    }

    function deepFreeze (object) {
        if (typeof Object.freeze === 'function') {
            return deepFreezeUsingObjectFreeze(object);
        }
        return object;
    }


    return {
        isArray: isArray,
        isString: isString,
        isNumber: isNumber,
        isBoolean: isBoolean,
        join: join,
        map: map,
        filter: filter,
        deepFreeze: deepFreeze
    };
}());

var charHelper = (function () {

    function isAlpha (chr) {
        return (chr >= 'a' && chr <= 'z') || ((chr >= 'A' && chr <= 'Z'));
    }

    function isDigit (chr) {
        return chr >= '0' && chr <= '9';
    }

    function isHexDigit (chr) {
        return isDigit(chr) || (chr >= 'a' && chr <= 'f') || (chr >= 'A' && chr <= 'F');
    }

    return {
        isAlpha: isAlpha,
        isDigit: isDigit,
        isHexDigit: isHexDigit
    };
}());

var pctEncoder = (function () {
    var utf8 = {
        encode: function (chr) {
            // see http://ecmanaut.blogspot.de/2006/07/encoding-decoding-utf8-in-javascript.html
            return unescape(encodeURIComponent(chr));
        },
        numBytes: function (firstCharCode) {
            if (firstCharCode <= 0x7F) {
                return 1;
            }
            else if (0xC2 <= firstCharCode && firstCharCode <= 0xDF) {
                return 2;
            }
            else if (0xE0 <= firstCharCode && firstCharCode <= 0xEF) {
                return 3;
            }
            else if (0xF0 <= firstCharCode && firstCharCode <= 0xF4) {
                return 4;
            }
            // no valid first octet
            return 0;
        },
        isValidFollowingCharCode: function (charCode) {
            return 0x80 <= charCode && charCode <= 0xBF;
        }
    };

    function pad0(v) {
      if (v.length > 1) return v;
      return '0'+v;
    }

    /**
     * encodes a character, if needed or not.
     * @param chr
     * @return pct-encoded character
     */
    function encodeCharacter (chr) {
        var
            result = '',
            octets = utf8.encode(chr),
            octet,
            index;
        for (index = 0; index < octets.length; index += 1) {
            octet = octets.charCodeAt(index);
            result += '%' + pad0(octet.toString(16).toUpperCase());
        }
        return result;
    }

    /**
     * Returns, whether the given text at start is in the form 'percent hex-digit hex-digit', like '%3F'
     * @param text
     * @param start
     * @return {boolean|*|*}
     */
    function isPercentDigitDigit (text, start) {
        return text.charAt(start) === '%' && charHelper.isHexDigit(text.charAt(start + 1)) && charHelper.isHexDigit(text.charAt(start + 2));
    }

    /**
     * Parses a hex number from start with length 2.
     * @param text a string
     * @param start the start index of the 2-digit hex number
     * @return {Number}
     */
    function parseHex2 (text, start) {
        return parseInt(text.substr(start, 2), 16);
    }

    /**
     * Returns whether or not the given char sequence is a correctly pct-encoded sequence.
     * @param chr
     * @return {boolean}
     */
    function isPctEncoded (chr) {
        if (!isPercentDigitDigit(chr, 0)) {
            return false;
        }
        var firstCharCode = parseHex2(chr, 1);
        var numBytes = utf8.numBytes(firstCharCode);
        if (numBytes === 0) {
            return false;
        }
        for (var byteNumber = 1; byteNumber < numBytes; byteNumber += 1) {
            if (!isPercentDigitDigit(chr, 3*byteNumber) || !utf8.isValidFollowingCharCode(parseHex2(chr, 3*byteNumber + 1))) {
                return false;
            }
        }
        return true;
    }

    /**
     * Reads as much as needed from the text, e.g. '%20' or '%C3%B6'. It does not decode!
     * @param text
     * @param startIndex
     * @return the character or pct-string of the text at startIndex
     */
    function pctCharAt(text, startIndex) {
        var chr = text.charAt(startIndex);
        if (!isPercentDigitDigit(text, startIndex)) {
            return chr;
        }
        var utf8CharCode = parseHex2(text, startIndex + 1);
        var numBytes = utf8.numBytes(utf8CharCode);
        if (numBytes === 0) {
            return chr;
        }
        for (var byteNumber = 1; byteNumber < numBytes; byteNumber += 1) {
            if (!isPercentDigitDigit(text, startIndex + 3 * byteNumber) || !utf8.isValidFollowingCharCode(parseHex2(text, startIndex + 3 * byteNumber + 1))) {
                return chr;
            }
        }
        return text.substr(startIndex, 3 * numBytes);
    }

    return {
        encodeCharacter: encodeCharacter,
        isPctEncoded: isPctEncoded,
        pctCharAt: pctCharAt
    };
}());

var rfcCharHelper = (function () {

    /**
     * Returns if an character is an varchar character according 2.3 of rfc 6570
     * @param chr
     * @return (Boolean)
     */
    function isVarchar (chr) {
        return charHelper.isAlpha(chr) || charHelper.isDigit(chr) || chr === '_' || pctEncoder.isPctEncoded(chr);
    }

    /**
     * Returns if chr is an unreserved character according 1.5 of rfc 6570
     * @param chr
     * @return {Boolean}
     */
    function isUnreserved (chr) {
        return charHelper.isAlpha(chr) || charHelper.isDigit(chr) || chr === '-' || chr === '.' || chr === '_' || chr === '~';
    }

    /**
     * Returns if chr is an reserved character according 1.5 of rfc 6570
     * or the percent character mentioned in 3.2.1.
     * @param chr
     * @return {Boolean}
     */
    function isReserved (chr) {
        return chr === ':' || chr === '/' || chr === '?' || chr === '#' || chr === '[' || chr === ']' || chr === '@' || chr === '!' || chr === '$' || chr === '&' || chr === '(' ||
            chr === ')' || chr === '*' || chr === '+' || chr === ',' || chr === ';' || chr === '=' || chr === "'";
    }

    return {
        isVarchar: isVarchar,
        isUnreserved: isUnreserved,
        isReserved: isReserved
    };

}());

/**
 * encoding of rfc 6570
 */
var encodingHelper = (function () {

    function encode (text, passReserved) {
        var
            result = '',
            index,
            chr = '';
        if (typeof text === "number" || typeof text === "boolean") {
            text = text.toString();
        }
        for (index = 0; index < text.length; index += chr.length) {
            chr = text.charAt(index);
            result += rfcCharHelper.isUnreserved(chr) || (passReserved && rfcCharHelper.isReserved(chr)) ? chr : pctEncoder.encodeCharacter(chr);
        }
        return result;
    }

    function encodePassReserved (text) {
        return encode(text, true);
    }

    function encodeLiteralCharacter (literal, index) {
        var chr = pctEncoder.pctCharAt(literal, index);
        if (chr.length > 1) {
            return chr;
        }
        else {
            return rfcCharHelper.isReserved(chr) || rfcCharHelper.isUnreserved(chr) ? chr : pctEncoder.encodeCharacter(chr);
        }
    }

    function encodeLiteral (literal) {
        var
            result = '',
            index,
            chr = '';
        for (index = 0; index < literal.length; index += chr.length) {
            chr = pctEncoder.pctCharAt(literal, index);
            if (chr.length > 1) {
                result += chr;
            }
            else {
                result += rfcCharHelper.isReserved(chr) || rfcCharHelper.isUnreserved(chr) ? chr : pctEncoder.encodeCharacter(chr);
            }
        }
        return result;
    }

    return {
        encode: encode,
        encodePassReserved: encodePassReserved,
        encodeLiteral: encodeLiteral,
        encodeLiteralCharacter: encodeLiteralCharacter
    };

}());


// the operators defined by rfc 6570
var operators = (function () {

    var
        bySymbol = {};

    function create (symbol) {
        bySymbol[symbol] = {
            symbol: symbol,
            separator: (symbol === '?') ? '&' : (symbol === '' || symbol === '+' || symbol === '#') ? ',' : symbol,
            named: symbol === ';' || symbol === '&' || symbol === '?',
            ifEmpty: (symbol === '&' || symbol === '?') ? '=' : '',
            first: (symbol === '+' ) ? '' : symbol,
            encode: (symbol === '+' || symbol === '#') ? encodingHelper.encodePassReserved : encodingHelper.encode,
            toString: function () {
                return this.symbol;
            }
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
    return {
        valueOf: function (chr) {
            if (bySymbol[chr]) {
                return bySymbol[chr];
            }
            if ("=,!@|".indexOf(chr) >= 0) {
                return null;
            }
            return bySymbol[''];
        }
    };
}());


/**
 * Detects, whether a given element is defined in the sense of rfc 6570
 * Section 2.3 of the RFC makes clear defintions:
 * * undefined and null are not defined.
 * * the empty string is defined
 * * an array ("list") is defined, if it is not empty (even if all elements are not defined)
 * * an object ("map") is defined, if it contains at least one property with defined value
 * @param object
 * @return {Boolean}
 */
function isDefined (object) {
    var
        propertyName;
    if (object === null || object === undefined) {
        return false;
    }
    if (objectHelper.isArray(object)) {
        // Section 2.3: A variable defined as a list value is considered undefined if the list contains zero members
        return object.length > 0;
    }
    if (typeof object === "string" || typeof object === "number" || typeof object === "boolean") {
        // falsy values like empty strings, false or 0 are "defined"
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

var LiteralExpression = (function () {
    function LiteralExpression (literal) {
        this.literal = encodingHelper.encodeLiteral(literal);
    }

    LiteralExpression.prototype.expand = function () {
        return this.literal;
    };

    LiteralExpression.prototype.toString = LiteralExpression.prototype.expand;

    return LiteralExpression;
}());

var parse = (function () {

    function parseExpression (expressionText) {
        var
            operator,
            varspecs = [],
            varspec = null,
            varnameStart = null,
            maxLengthStart = null,
            index,
            chr = '';

        function closeVarname () {
            var varname = expressionText.substring(varnameStart, index);
            if (varname.length === 0) {
                throw new UriTemplateError({expressionText: expressionText, message: "a varname must be specified", position: index});
            }
            varspec = {varname: varname, exploded: false, maxLength: null};
            varnameStart = null;
        }

        function closeMaxLength () {
            if (maxLengthStart === index) {
                throw new UriTemplateError({expressionText: expressionText, message: "after a ':' you have to specify the length", position: index});
            }
            varspec.maxLength = parseInt(expressionText.substring(maxLengthStart, index), 10);
            maxLengthStart = null;
        }

        operator = (function (operatorText) {
            var op = operators.valueOf(operatorText);
            if (op === null) {
                throw new UriTemplateError({expressionText: expressionText, message: "illegal use of reserved operator", position: index, operator: operatorText});
            }
            return op;
        }(expressionText.charAt(0)));
        index = operator.symbol.length;

        varnameStart = index;

        for (; index < expressionText.length; index += chr.length) {
            chr = pctEncoder.pctCharAt(expressionText, index);

            if (varnameStart !== null) {
                // the spec says: varname =  varchar *( ["."] varchar )
                // so a dot is allowed except for the first char
                if (chr === '.') {
                    if (varnameStart === index) {
                        throw new UriTemplateError({expressionText: expressionText, message: "a varname MUST NOT start with a dot", position: index});
                    }
                    continue;
                }
                if (rfcCharHelper.isVarchar(chr)) {
                    continue;
                }
                closeVarname();
            }
            if (maxLengthStart !== null) {
                if (index === maxLengthStart && chr === '0') {
                    throw new UriTemplateError({expressionText: expressionText, message: "A :prefix must not start with digit 0", position: index});
                }
                if (charHelper.isDigit(chr)) {
                    if (index - maxLengthStart >= 4) {
                        throw new UriTemplateError({expressionText: expressionText, message: "A :prefix must have max 4 digits", position: index});
                    }
                    continue;
                }
                closeMaxLength();
            }
            if (chr === ':') {
                if (varspec.maxLength !== null) {
                    throw new UriTemplateError({expressionText: expressionText, message: "only one :maxLength is allowed per varspec", position: index});
                }
                if (varspec.exploded) {
                    throw new UriTemplateError({expressionText: expressionText, message: "an exploeded varspec MUST NOT be varspeced", position: index});
                }
                maxLengthStart = index + 1;
                continue;
            }
            if (chr === '*') {
                if (varspec === null) {
                    throw new UriTemplateError({expressionText: expressionText, message: "exploded without varspec", position: index});
                }
                if (varspec.exploded) {
                    throw new UriTemplateError({expressionText: expressionText, message: "exploded twice", position: index});
                }
                if (varspec.maxLength) {
                    throw new UriTemplateError({expressionText: expressionText, message: "an explode (*) MUST NOT follow to a prefix", position: index});
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
            throw new UriTemplateError({expressionText: expressionText, message: "illegal character", character: chr, position: index});
        } // for chr
        if (varnameStart !== null) {
            closeVarname();
        }
        if (maxLengthStart !== null) {
            closeMaxLength();
        }
        varspecs.push(varspec);
        return new VariableExpression(expressionText, operator, varspecs);
    }

    function parse (uriTemplateText) {
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
                    throw new UriTemplateError({templateText: uriTemplateText, message: "unopened brace closed", position: index});
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
                    throw new UriTemplateError({templateText: uriTemplateText, message: "brace already opened", position: index});
                }
                if (chr === '}') {
                    if (braceOpenIndex + 1 === index) {
                        throw new UriTemplateError({templateText: uriTemplateText, message: "empty braces", position: braceOpenIndex});
                    }
                    try {
                        expressions.push(parseExpression(uriTemplateText.substring(braceOpenIndex + 1, index)));
                    }
                    catch (error) {
                        if (error.prototype === UriTemplateError.prototype) {
                            throw new UriTemplateError({templateText: uriTemplateText, message: error.options.message, position: braceOpenIndex + error.options.position, details: error.options});
                        }
                        throw error;
                    }
                    braceOpenIndex = null;
                    literalStart = index + 1;
                }
                continue;
            }
            throw new Error('reached unreachable code');
        }
        if (braceOpenIndex !== null) {
            throw new UriTemplateError({templateText: uriTemplateText, message: "unclosed brace", position: braceOpenIndex});
        }
        if (literalStart < uriTemplateText.length) {
            expressions.push(new LiteralExpression(uriTemplateText.substr(literalStart)));
        }
        return new UriTemplate(uriTemplateText, expressions);
    }

    return parse;
}());

var VariableExpression = (function () {
    // helper function if JSON is not available
    function prettyPrint (value) {
        return (JSON && JSON.stringify) ? JSON.stringify(value) : value;
    }

    function isEmpty (value) {
        if (!isDefined(value)) {
            return true;
        }
        if (objectHelper.isString(value)) {
            return value === '';
        }
        if (objectHelper.isNumber(value) || objectHelper.isBoolean(value)) {
            return false;
        }
        if (objectHelper.isArray(value)) {
            return value.length === 0;
        }
        for (var propertyName in value) {
            if (value.hasOwnProperty(propertyName)) {
                return false;
            }
        }
        return true;
    }

    function propertyArray (object) {
        var
            result = [],
            propertyName;
        for (propertyName in object) {
            if (object.hasOwnProperty(propertyName)) {
                result.push({name: propertyName, value: object[propertyName]});
            }
        }
        return result;
    }

    function VariableExpression (templateText, operator, varspecs) {
        this.templateText = templateText;
        this.operator = operator;
        this.varspecs = varspecs;
    }

    VariableExpression.prototype.toString = function () {
        return this.templateText;
    };

    function expandSimpleValue(varspec, operator, value) {
        var result = '';
        value = value.toString();
        if (operator.named) {
            result += encodingHelper.encodeLiteral(varspec.varname);
            if (value === '') {
                result += operator.ifEmpty;
                return result;
            }
            result += '=';
        }
        if (varspec.maxLength !== null) {
            value = value.substr(0, varspec.maxLength);
        }
        result += operator.encode(value);
        return result;
    }

    function valueDefined (nameValue) {
        return isDefined(nameValue.value);
    }

    function expandNotExploded(varspec, operator, value) {
        var
            arr = [],
            result = '';
        if (operator.named) {
            result += encodingHelper.encodeLiteral(varspec.varname);
            if (isEmpty(value)) {
                result += operator.ifEmpty;
                return result;
            }
            result += '=';
        }
        if (objectHelper.isArray(value)) {
            arr = value;
            arr = objectHelper.filter(arr, isDefined);
            arr = objectHelper.map(arr, operator.encode);
            result += objectHelper.join(arr, ',');
        }
        else {
            arr = propertyArray(value);
            arr = objectHelper.filter(arr, valueDefined);
            arr = objectHelper.map(arr, function (nameValue) {
                return operator.encode(nameValue.name) + ',' + operator.encode(nameValue.value);
            });
            result += objectHelper.join(arr, ',');
        }
        return result;
    }

    function expandExplodedNamed (varspec, operator, value) {
        var
            isArray = objectHelper.isArray(value),
            arr = [];
        if (isArray) {
            arr = value;
            arr = objectHelper.filter(arr, isDefined);
            arr = objectHelper.map(arr, function (listElement) {
                var tmp = encodingHelper.encodeLiteral(varspec.varname);
                if (isEmpty(listElement)) {
                    tmp += operator.ifEmpty;
                }
                else {
                    tmp += '=' + operator.encode(listElement);
                }
                return tmp;
            });
        }
        else {
            arr = propertyArray(value);
            arr = objectHelper.filter(arr, valueDefined);
            arr = objectHelper.map(arr, function (nameValue) {
                var tmp = encodingHelper.encodeLiteral(nameValue.name);
                if (isEmpty(nameValue.value)) {
                    tmp += operator.ifEmpty;
                }
                else {
                    tmp += '=' + operator.encode(nameValue.value);
                }
                return tmp;
            });
        }
        return objectHelper.join(arr, operator.separator);
    }

    function expandExplodedUnnamed (operator, value) {
        var
            arr = [],
            result = '';
        if (objectHelper.isArray(value)) {
            arr = value;
            arr = objectHelper.filter(arr, isDefined);
            arr = objectHelper.map(arr, operator.encode);
            result += objectHelper.join(arr, operator.separator);
        }
        else {
            arr = propertyArray(value);
            arr = objectHelper.filter(arr, function (nameValue) {
                return isDefined(nameValue.value);
            });
            arr = objectHelper.map(arr, function (nameValue) {
                return operator.encode(nameValue.name) + '=' + operator.encode(nameValue.value);
            });
            result += objectHelper.join(arr, operator.separator);
        }
        return result;
    }


    VariableExpression.prototype.expand = function (variables) {
        var
            expanded = [],
            index,
            varspec,
            value,
            valueIsArr,
            oneExploded = false,
            operator = this.operator;

        // expand each varspec and join with operator's separator
        for (index = 0; index < this.varspecs.length; index += 1) {
            varspec = this.varspecs[index];
            value = variables[varspec.varname];
            // if (!isDefined(value)) {
            // if (variables.hasOwnProperty(varspec.name)) {
            if (value === null || value === undefined) {
                continue;
            }
            if (varspec.exploded) {
                oneExploded = true;
            }
            valueIsArr = objectHelper.isArray(value);
            if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
                expanded.push(expandSimpleValue(varspec, operator, value));
            }
            else if (varspec.maxLength && isDefined(value)) {
                // 2.4.1 of the spec says: "Prefix modifiers are not applicable to variables that have composite values."
                throw new Error('Prefix modifiers are not applicable to variables that have composite values. You tried to expand ' + this + " with " + prettyPrint(value));
            }
            else if (!varspec.exploded) {
                if (operator.named || !isEmpty(value)) {
                    expanded.push(expandNotExploded(varspec, operator, value));
                }
            }
            else if (isDefined(value)) {
                if (operator.named) {
                    expanded.push(expandExplodedNamed(varspec, operator, value));
                }
                else {
                    expanded.push(expandExplodedUnnamed(operator, value));
                }
            }
        }

        if (expanded.length === 0) {
            return "";
        }
        else {
            return operator.first + objectHelper.join(expanded, operator.separator);
        }
    };

    return VariableExpression;
}());

var UriTemplate = (function () {
    function UriTemplate (templateText, expressions) {
        this.templateText = templateText;
        this.expressions = expressions;
        objectHelper.deepFreeze(this);
    }

    UriTemplate.prototype.toString = function () {
        return this.templateText;
    };

    UriTemplate.prototype.expand = function (variables) {
        // this.expressions.map(function (expression) {return expression.expand(variables);}).join('');
        var
            index,
            result = '';
        for (index = 0; index < this.expressions.length; index += 1) {
            result += this.expressions[index].expand(variables);
        }
        return result;
    };

    UriTemplate.parse = parse;
    UriTemplate.UriTemplateError = UriTemplateError;
    return UriTemplate;
}());

    exportCallback(UriTemplate);

}(function (UriTemplate) {
        "use strict";
        local.web.UriTemplate = UriTemplate;
}));// Navigator
// =========

function getEnvironmentHost() {
	if (typeof window !== 'undefined') return window.location.host;
	if (app) return app.config.environmentHost; // must be passed to in the ready config
	return '';
}

// NavigatorContext
// ================
// INTERNAL
// information about the resource that a navigator targets
//  - exists in an "unresolved" state until the URI is confirmed by a response from the server
//  - enters a "bad" state if an attempt to resolve the link failed
//  - may be "relative" if described by a relation from another context (eg a query or a relative URI)
//  - may be "absolute" if described by an absolute URI
// :NOTE: absolute contexts may have a URI without being resolved, so don't take the presence of a URI as a sign that the resource exists
function NavigatorContext(query) {
	this.query = query;
	this.resolveState = NavigatorContext.UNRESOLVED;
	this.error = null;
	this.queryIsAbsolute = (typeof query == 'string' && local.web.isAbsUri(query));
	if (this.queryIsAbsolute) {
		this.url  = query;
		this.urld = local.web.parseUri(this.url);
	} else {
		this.url = null;
		this.urld = null;
	}
}
NavigatorContext.UNRESOLVED = 0;
NavigatorContext.RESOLVED   = 1;
NavigatorContext.FAILED     = 2;
NavigatorContext.prototype.isResolved = function() { return this.resolveState === NavigatorContext.RESOLVED; };
NavigatorContext.prototype.isBad      = function() { return this.resolveState === NavigatorContext.FAILED; };
NavigatorContext.prototype.isRelative = function() { return (!this.queryIsAbsolute); };
NavigatorContext.prototype.isAbsolute = function() { return this.queryIsAbsolute; };
NavigatorContext.prototype.getUrl     = function() { return this.url; };
NavigatorContext.prototype.getError   = function() { return this.error; };
NavigatorContext.prototype.resetResolvedState = function() {
	this.resolveState = NavigatorContext.UNRESOLVED;
	this.error = null;
};
NavigatorContext.prototype.setResolved = function(url) {
	this.error        = null;
	this.resolveState = NavigatorContext.RESOLVED;
	if (url) {
		this.url          = url;
		this.urld         = local.web.parseUri(this.url);
	}
};
NavigatorContext.prototype.setFailed = function(error) {
	this.error        = error;
	this.resolveState = NavigatorContext.FAILED;
};

// Navigator
// =========
// EXPORTED
// API to follow resource links (as specified by the response Link header)
//  - uses the rel attribute as the primary link label
//  - uses URI templates to generate URIs
//  - queues link navigations until a request is made
/*

// EXAMPLE 1. Get Bob from Foobar.com
// - basic navigation
// - requests
var foobarService = local.web.navigator('https://foobar.com');
var bob = foobarService.follow('rel:||collection=users||item=bob');
// ^ or foobarService.follow([{ rel: 'collection', id: 'users' }, { rel: 'item', id:'bob' }]);
// ^ or foobarService.follow({ rel: 'collection', id: 'users' }).follow({ rel: 'item', id:'bob' });
bob.get()
	// -> HEAD https://foobar.com
	// -> HEAD https://foobar.com/users
	// -> GET  https://foobar.com/users/bob (Accept: application/json)
	.then(function(response) {
		var bobsProfile = response.body;

		// Update Bob's email
		bobsProfile.email = 'bob@gmail.com';
		bob.put(bobsProfile);
		// -> PUT https://foobar.com/users/bob { email:'bob@gmail.com', ...} (Content-Type: application/json)
	});

// EXAMPLE 2. Get all users who joined after 2013, in pages of 150
// - additional navigation query parameters
// - server-driven batching
var pageCursor = foobarService.follow('rel:||collection=users,since=2013-01-01,limit=150');
pageCursor.get()
	// -> GET https://foobar.com/users?since=2013-01-01&limit=150 (Accept: application/json)
	.then(function readNextPage(response) {
		// Send the emails
		emailNewbieGreetings(response.body); // -- emailNewbieGreetings is a fake utility function

		// Go to the 'next page' link, as supplied by the response
		pageCursor = pageCursor.follow('rel:||next');
		return pageCursor.get().then(readNextPage);
		// -> GET https://foobar.com/users?since=2013-01-01&limit=150&offset=150 (Accept: application/json)
	})
	.fail(function(response, request) {
		// Not finding a 'rel=next' link means the server didn't give us one.
		if (response.status == local.web.LINK_NOT_FOUND) { // 001 Local: Link not found - termination condition
			// Tell Bob his greeting was sent
			bob.follow('rel:||grimwire.com/-mail/inbox').post({
				title: '2013 Welcome Emails Sent',
				body: 'Good work, Bob.'
			});
			// -> POST https://foobar.com/mail/users/bob/inbox (Content-Type: application/json)
		} else {
			// Tell Bob something went wrong
			bob.follow('rel:||grimwire.com/-mail/inbox').post({
				title: 'ERROR! 2013 Welcome Emails Failed!',
				body: 'Way to blow it, Bob.',
				attachments: {
					'dump.json': {
						context: pageCursor.getContext(),
						request: request,
						response: response
					}
				}
			});
			// -> POST https://foobar.com/mail/users/bob/inbox (Content-Type: application/json)
		}
	});
*/
function Navigator(context, parentNavigator) {
	this.context         = context         || null;
	this.parentNavigator = parentNavigator || null;
	this.links           = null;
	this.requestDefaults = null;

	if (this.context.isRelative() && !parentNavigator)
		throw new Error("A parentNavigator is required for navigators with relative contexts");
}
local.web.Navigator = Navigator;

// Sets defaults to be used in all requests
// - eg nav.setRequestDefaults({ method: 'GET', headers: { authorization: 'bob:pass', accept: 'text/html' }})
// - eg nav.setRequestDefaults({ proxy: 'httpl://myproxy.app' })
Navigator.prototype.setRequestDefaults = function(v) {
	this.requestDefaults = v;
};

// Helper to copy over request defaults
function copyDefaults(target, defaults) {
	for (var k in defaults) {
		if (k == 'headers' || !!target[k])
			continue;
		// ^ headers should be copied per-attribute
		if (typeof defaults[k] == 'object')
			target[k] = local.util.deepClone(defaults[k]);
		else
			target[k] = defaults[k];
	}
	if (defaults.headers) {
		if (!target.headers)
			target.headers = {};
		copyDefaults(target.headers, defaults.headers);
	}
}

// Executes an HTTP request to our context
//  - uses additional parameters on the request options:
//    - retry: bool, should the url resolve be tried if it previously failed?
Navigator.prototype.dispatch = function(req) {
	if (!req) req = {};
	if (!req.headers) req.headers = {};
	var self = this;

	if (this.requestDefaults)
		copyDefaults(req, this.requestDefaults);

	// Resolve our target URL
	return ((req.url) ? local.promise(req.url) : this.resolve({ retry: req.retry, nohead: true }))
		.succeed(function(url) {
			req.url = url;
			return local.web.dispatch(req);
		})
		.succeed(function(res) {
			// After every successful request, update our links and mark our context as good (in case it had been bad)
			self.context.setResolved();
			if (res.headers.link) self.links = res.headers.link;
			else self.links = self.links || []; // cache an empty link list so we dont keep trying during resolution
			return res;
		})
		.fail(function(res) {
			// Let a 1 or 404 indicate a bad context (as opposed to some non-navigational error like a bad request body)
			if (res.status === local.web.LINK_NOT_FOUND || res.status === 404)
				self.context.setFailed(res);
			throw res;
		});
};

// Executes a GET text/event-stream request to our context
Navigator.prototype.subscribe = function(req) {
	var self = this;
	if (!req) req = {};
	return this.resolve().succeed(function(url) {
		req.url = url;

		if (self.requestDefaults)
			copyDefaults(req, self.requestDefaults);

		return local.web.subscribe(req);
	});
};

// Follows a link relation from our context, generating a new navigator
// - `query` may be:
//   - an object in the same form of a `local.web.queryLink()` parameter
//   - an array of link query objects (to be followed sequentially)
//   - a URI string
//     - if using the 'rel:' scheme, will convert the URI into a link query object
//     - if a relative URI using the HTTP/S/L scheme, will follow the relation relative to the current context
//     - if an absolute URI using the HTTP/S/L scheme, will go to that URI
// - uses URI Templates to generate URLs
// - when querying, only the `rel` and `id` (if specified) attributes must match
//   - the exception to this is: `rel` matches and the HREF has an {id} token
//   - all other attributes are used to fill URI Template tokens and are not required to match
Navigator.prototype.follow = function(query) {
	// convert rel: uri to a query array
	if (typeof query == 'string' && local.web.isRelSchemeUri(query))
		query = local.web.parseRelUri(query);

	// make sure we always have an array
	if (!Array.isArray(query))
		query = [query];

	// build a full follow() chain
	var nav = this;
	do {
		nav = new Navigator(new NavigatorContext(query.shift()), nav);
		if (this.requestDefaults)
			nav.setRequestDefaults(this.requestDefaults);
	} while (query[0]);

	return nav;
};

// Resolves the navigator's URL, reporting failure if a link or resource is unfound
//  - also ensures the links have been retrieved from the context
//  - may trigger resolution of parent contexts
//  - options is optional and may include:
//    - retry: bool, should the resolve be tried if it previously failed?
//    - nohead: bool, should we issue a HEAD request once we have a URL? (not favorable if planning to dispatch something else)
//  - returns a promise
Navigator.prototype.resolve = function(options) {
	var self = this;
	options = options || {};

	var nohead = options.nohead;
	delete options.nohead;
	// ^ pull `nohead` out so that parent resolves are `nohead: false` - we do want them to dispatch HEAD requests to resolve us

	var resolvePromise = local.promise();
	if (this.links !== null && (this.context.isResolved() || (this.context.isAbsolute() && this.context.isBad() === false))) {
		// We have links and we were previously resolved (or we're absolute so there's no need)
		resolvePromise.fulfill(this.context.getUrl());
	} else if (this.context.isBad() === false || (this.context.isBad() && options.retry)) {
		// We don't have links, and we haven't previously failed (or we want to try again)
		this.context.resetResolvedState();

		if (this.context.isRelative()) {
			if (!this.parentNavigator)
				throw new Error("Relative navigator has no parent");

			// Up the chain we go
			resolvePromise = this.parentNavigator.resolve(options)
				.succeed(function() {
					// Parent resolved, query its links
					var childUrl = self.parentNavigator.lookupLink(self.context);
					if (childUrl) {
						// We have a pope! I mean, link.
						self.context.setResolved(childUrl);

						// Send a HEAD request to get our links
						if (nohead) // unless dont
							return childUrl;
						return self.dispatch({ method: 'HEAD', url: childUrl })
							.succeed(function() { return childUrl; }); // fulfill resolvePromise afterward
					}

					// Error - Link not found
					var response = new local.web.Response();
					response.writeHead(local.web.LINK_NOT_FOUND, 'link query failed to match').end();
					throw response;
				})
				.fail(function(error) {
					self.context.setFailed(error);
					throw error;
				});
		} else {
			// At the top of the chain already
			if (nohead)
				resolvePromise.fulfill(self.context.getUrl());
			else {
				resolvePromise = this.dispatch({ method: 'HEAD', url: self.context.getUrl() })
					.succeed(function(res) { return self.context.getUrl(); });
			}
		}
	} else {
		// We failed in the past and we don't want to try again
		resolvePromise.reject(this.context.getError());
	}
	return resolvePromise;
};

// Looks up a link in the cache and generates the URI (the follow logic)
Navigator.prototype.lookupLink = function(context) {
	if (context.query) {
		if (typeof context.query == 'object') {
			// Try to find a link with matching rel and id
			var link, reducedQuery = { rel: context.query.rel, id: context.query.id };
			link = local.web.queryLinks1(this.links, reducedQuery);
			if (!link && reducedQuery.id) {
				// Try again without the id
				reducedQuery.id = undefined;
				link = local.web.queryLinks1(this.links, reducedQuery);
				// Make sure we got a link with an id templating token
				if (/{id}/.test(link.href) === false)
					link = null;
			}

			if (link)
				return local.web.UriTemplate.parse(link.href).expand(context.query);
		}
		else if (typeof context.query == 'string') {
			// A URL
			if (!local.web.isAbsUrl(context.query))
				return local.web.joinRelPath(this.context.urld, context.query);
			return context.query;
		}
	}
	console.log('Failed to find a link to resolve context. Link query:', context.query, 'Navigator:', this);
	return null;
};

// Dispatch Sugars
// ===============
function makeDispSugar(method) {
	return function(headers, options) {
		var req = options || {};
		req.headers = headers || {};
		req.method = method;
		return this.dispatch(req);
	};
}
function makeDispWBodySugar(method) {
	return function(body, headers, options) {
		var req = options || {};
		req.headers = headers || {};
		req.method = method;
		req.body = body;
		return this.dispatch(req);
	};
}
Navigator.prototype.head   = makeDispSugar('HEAD');
Navigator.prototype.get    = makeDispSugar('GET');
Navigator.prototype.delete = makeDispSugar('DELETE');
Navigator.prototype.post   = makeDispWBodySugar('POST');
Navigator.prototype.put    = makeDispWBodySugar('PUT');
Navigator.prototype.patch  = makeDispWBodySugar('PATCH');

// Builder
// =======
local.web.navigator = function(queryOrNav) {
	if (queryOrNav instanceof Navigator)
		return queryOrNav;

	// convert rel: uri to a query array
	if (typeof queryOrNav == 'string' && local.web.isRelSchemeUri(queryOrNav))
		queryOrNav = local.web.parseRelUri(queryOrNav);

	// make sure we always have an array
	if (!Array.isArray(queryOrNav))
		queryOrNav = [queryOrNav];

	// build a full follow() chain
	var nav = new Navigator(new NavigatorContext(queryOrNav.shift()));
	while (queryOrNav[0]) {
		nav = new Navigator(new NavigatorContext(queryOrNav.shift()), nav);
	}

	return nav;
};})();