// promises
// ========
// pfraze 2013

(function () {
	var exports = this;
	if (typeof window !== "undefined") {
		if (typeof window.local == 'undefined')
			window.local = {};
		exports = window.local;
	} else if (typeof self !== "undefined") {
		if (typeof self.local == 'undefined')
			self.local = {};
		exports = self.local;
	} else if (typeof module !== "undefined") {
		exports = module.exports;
	}

	function passThrough(v) { return v; }
	function isPromiselike(p) {
		return (p && typeof p.then == 'function');
	}

	// Promise
	// =======
	// EXPORTED
	// Monadic function chaining around asynchronously-fulfilled values
	// - conformant with the promises/a+ spec
	// - better to use the `promise` function to construct
	function Promise(value) {
		this.succeedCBs = []; // used to notify about fulfillments
		this.failCBs = []; // used to notify about rejections
		this.__hasValue = false;
		this.__hasFailed = false;
		this.value = undefined;
		if (value)
			this.fulfill(value);
	}
	Promise.prototype.isUnfulfilled = function() { return !this.__hasValue; };
	Promise.prototype.isRejected = function() { return this.__hasFailed; };
	Promise.prototype.isFulfilled = function() { return (this.__hasValue && !this.__hasFailed); };

	// helper function to execute `then` behavior
	function execCallback(parentPromise, targetPromise, fn) {
		if (fn === null) {
			if (parentPromise.isRejected())
				targetPromise.reject(parentPromise.value);
			else
				targetPromise.fulfill(parentPromise.value);
		} else {
			var newValue;
			try { newValue = fn(parentPromise.value); }
			catch (e) {
				if (e instanceof Error) {
					if (console.error)
						console.error(e, e.stack);
					else console.log("Promise exception thrown", e, e.stack);
				}
				targetPromise.reject(e);
			}

			if (isPromiselike(newValue))
				promise(newValue).chain(targetPromise);
			else
				targetPromise.fulfill(newValue);
		}
	}

	// add a 'succeed' and an 'fail' function to the sequence
	Promise.prototype.then = function(succeedFn, failFn) {
		succeedFn = (succeedFn && typeof succeedFn == 'function') ? succeedFn : null;
		failFn    = (failFn    && typeof failFn == 'function')    ? failFn    : null;

		var p = promise();
		if (this.isUnfulfilled()) {
			this.succeedCBs.push({ p:p, fn:succeedFn });
			this.failCBs.push({ p:p, fn:failFn });
		} else {
			var self = this;
			setTimeout(function() {
				if (self.isFulfilled())
					execCallback(self, p, succeedFn);
				else
					execCallback(self, p, failFn);
			}, 0);
		}
		return p;
	};

	// add a non-error function to the sequence
	// - will be skipped if in 'error' mode
	Promise.prototype.succeed = function(fn) {
		if (this.isRejected()) {
			return this;
		} else {
			var args = Array.prototype.slice.call(arguments, 1);
			return this.then(function(v) {
				return fn.apply(null, [v].concat(args));
			});
		}
	};

	// add an error function to the sequence
	// - will be skipped if in 'non-error' mode
	Promise.prototype.fail = function(fn) {
		if (this.isFulfilled()) {
			return this;
		} else {
			var args = Array.prototype.slice.call(arguments, 1);
			return this.then(null, function(v) {
				return fn.apply(null, [v].concat(args));
			});
		}
	};

	// add a function to the success and error paths of the sequence
	Promise.prototype.always = function(fn) {
		return this.then(fn, fn);
	};

	// sets the promise value, enters 'succeed' mode, and executes any queued `then` functions
	Promise.prototype.fulfill = function(value) {
		if (this.isUnfulfilled()) {
			this.value = value;
			this.__hasValue = true;
			for (var i=0; i < this.succeedCBs.length; i++) {
				var cb = this.succeedCBs[i];
				execCallback(this, cb.p, cb.fn);
			}
			this.succeedCBs.length = 0;
			this.failCBs.length = 0;
		}
		return this;
	};

	// sets the promise value, enters 'error' mode, and executes any queued `then` functions
	Promise.prototype.reject = function(err) {
		if (this.isUnfulfilled()) {
			this.value = err;
			this.__hasValue = true;
			this.__hasFailed = true;
			for (var i=0; i < this.failCBs.length; i++) {
				var cb = this.failCBs[i];
				execCallback(this, cb.p, cb.fn);
			}
			this.succeedCBs.length = 0;
			this.failCBs.length = 0;
		}
		return this;
	};

	// releases all of the remaining references in the prototype chain
	// - to be used in situations where promise handling will not continue, and memory needs to be freed
	Promise.prototype.cancel = function() {
		// propagate the command to promises later in the chain
		var i;
		for (i=0; i < this.succeedCBs.length; i++) {
			this.succeedCBs[i].p.cancel();
		}
		for (i=0; i < this.failCBs.length; i++) {
			this.failCBs[i].p.cancel();
		}
		// free up memory
		this.succeedCBs.length = 0;
		this.failCBs.length = 0;
		return this;
	};

	// sets up the given promise to fulfill/reject upon the method-owner's fulfill/reject
	Promise.prototype.chain = function(otherPromise) {
		this.then(
			function(v) {
				promise(otherPromise).fulfill(v);
				return v;
			},
			function(err) {
				promise(otherPromise).reject(err);
				return err;
			}
		);
		return otherPromise;
	};

	// provides a node-style function for fulfilling/rejecting based on the (err, result) pattern
	Promise.prototype.cb = function(err, value) {
		if (err)
			this.reject(err);
		else
			this.fulfill((typeof value == 'undefined') ? null : value);
	};

	// bundles an array of promises into a single promise that requires none to succeed for a pass
	// - `shouldFulfillCB` is called with (results, fails) to determine whether to fulfill or reject
	function bundle(ps, shouldFulfillCB) {
		if (!Array.isArray(ps)) ps = [ps];
		var p = promise(), nPromises = ps.length, nFinished = 0;
		if (nPromises === 0) {
			p.fulfill([]);
			return p;
		}

		var results = []; results.length = nPromises;
		var fails = [];
		var addResult = function(v, index, isfail) {
			results[index] = v;
			if (isfail) fails.push(index);
			if ((++nFinished) == nPromises) {
				if (!shouldFulfillCB) p.fulfill(results);
				else if (shouldFulfillCB(results, fails)) p.fulfill(results);
				else p.reject(results);
			}
		};
		for (var i=0; i < nPromises; i++)
			promise(ps[i]).succeed(addResult, i, false).fail(addResult, i, true);
		return p;
	}

	// bundles an array of promises into a single promise that requires all to succeed for a pass
	function all(ps) {
		return bundle(ps, function(results, fails) {
			return fails.length === 0;
		});
	}

	// bundles an array of promises into a single promise that requires one to succeed for a pass
	function any(ps) {
		return bundle(ps, function(results, fails) {
			return fails.length < results.length;
		});
	}

	// promise creator
	// - behaves like a guard, ensuring `v` is a promise
	// - if multiple arguments are given, will provide a promise that encompasses all of them
	//   - containing promise always succeeds
	function promise(v) {
		if (arguments.length > 1)
			return bundle(Array.prototype.slice.call(arguments));
		if (v instanceof Promise)
			return v;
		if (isPromiselike(v)) {
			var p = promise();
			v.then(function(v2) { p.fulfill(v2); }, function(v2) { p.reject(v2); });
			return p;
		}
		return new Promise(v);
	}

	exports.Promise = Promise;
	exports.promise = promise;
	exports.promise.bundle = bundle;
	exports.promise.all = all;
	exports.promise.any = any;
})();

if (typeof define !== "undefined") {
	define([], function() {
		return Promise;
	});
}// Local Utilities
// ===============
// pfraze 2013

if (typeof this.local == 'undefined')
	this.local = {};
if (typeof this.local.util == 'undefined')
	this.local.util = {};

(function() {// EventEmitter
// ============
// EXPORTED
// A minimal event emitter, based on the NodeJS api
// initial code borrowed from https://github.com/tmpvar/node-eventemitter (thanks tmpvar)
function EventEmitter() {
	Object.defineProperty(this, '_events', {
		value: {},
		configurable: false,
		enumerable: false,
		writable: true
	});
	Object.defineProperty(this, '_suspensions', {
		value: 0,
		configurable: false,
		enumerable: false,
		writable: true
	});
	Object.defineProperty(this, '_history', {
		value: [],
		configurable: false,
		enumerable: false,
		writable: true
	});
}

EventEmitter.prototype.suspendEvents = function() {
	this._suspensions++;
};

EventEmitter.prototype.resumeEvents = function() {
	this._suspensions--;
	if (this._suspensions <= 0)
		this.playbackHistory();
};

EventEmitter.prototype.isSuspended = function() { return this._suspensions > 0; };

EventEmitter.prototype.playbackHistory = function() {
	var e;
	// always check if we're suspended - a handler might resuspend us
	while (!this.isSuspended() && (e = this._history.shift()))
		this.emit.apply(this, e);
}

EventEmitter.prototype.emit = function(type) {
	var args = Array.prototype.slice.call(arguments);

	if (this.isSuspended()) {
		this._history.push(args);
		return;
	}

	var handlers = this._events[type];
	if (!handlers) return false;

	args = args.slice(1);
	for (var i = 0, l = handlers.length; i < l; i++)
		handlers[i].apply(this, args);

	return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
	if (Array.isArray(type)) {
		type.forEach(function(t) { this.addListener(t, listener); }, this);
		return;
	}

	if ('function' !== typeof listener) {
		throw new Error('addListener only takes instances of Function');
	}

	// To avoid recursion in the case that type == "newListeners"! Before
	// adding it to the listeners, first emit "newListeners".
	this.emit('newListener', type, listener);

	if (!this._events[type]) {
		this._events[type] = [listener];
	} else {
		this._events[type].push(listener);
	}

	return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
	var self = this;
	self.on(type, function g() {
		self.removeListener(type, g);
		listener.apply(this, arguments);
	});
};

EventEmitter.prototype.removeListener = function(type, listener) {
	if ('function' !== typeof listener) {
		throw new Error('removeListener only takes instances of Function');
	}
	if (!this._events[type]) return this;

	var list = this._events[type];
	var i = list.indexOf(listener);
	if (i < 0) return this;
	list.splice(i, 1);
	if (list.length === 0) {
		delete this._events[type];
	}

	return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
	if (type && this._events[type]) this._events[type] = null;
	if (this._history[type]) this._history[type] = null;
	return this;
};

EventEmitter.prototype.listeners = function(type) {
	return this._events[type];
};

local.util.EventEmitter = EventEmitter;})();// Local HTTP
// ==========
// pfraze 2013

if (typeof this.local == 'undefined')
	this.local = {};
if (typeof this.local.web == 'undefined')
	this.local.web = {};

(function() {
	function noop() {}// Helpers
// =======

// EXPORTED
// breaks a link header into a javascript object
local.web.parseLinkHeader = function parseLinkHeader(headerStr) {
	if (typeof headerStr !== 'string') {
		return headerStr;
	}
	// '</foo/bar>; rel="baz"; id="blah", </foo/bar>; rel="baz"; id="blah", </foo/bar>; rel="baz"; id="blah"'
	return headerStr.replace(/,[\s]*</g, '|||<').split('|||').map(function(linkStr) {
		// ['</foo/bar>; rel="baz"; id="blah"', '</foo/bar>; rel="baz"; id="blah"']
		var link = {};
		linkStr.trim().split(';').forEach(function(attrStr) {
			// ['</foo/bar>', 'rel="baz"', 'id="blah"']
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
//  - first looks for a matching rel and id
//    eg lookupLink(links, 'item', 'foobar'), Link: <http://example.com/some/foobar>; rel="item"; id="foobar" -> http://example.com/some/foobar
//  - then looks for a matching rel with no id and uses that to generate the link
//    eg lookupLink(links, 'item', 'foobar'), Link: <http://example.com/some/{id}>; rel="item" -> http://example.com/some/foobar
local.web.lookupLink = function lookupLink(links, rel, id) {
	var len = links ? links.length : 0;
	if (!len) { return null; }

	if (id)
		id = id.toLowerCase();
	var relRegex = RegExp('\\b'+rel+'\\b');

	// try to find the link with a id equal to the param we were given
	var match = null;
	for (var i=0; i < len; i++) {
		var link = links[i];
		if (!link) { continue; }
		// find all links with a matching rel
		if (relRegex.test(link.rel)) {
			// look for a id match to the primary parameter
			if (id && link.id) {
				if (link.id.toLowerCase() === id) {
					match = link;
					break;
				}
			} else {
				// no id attribute -- it's the template URI, so hold onto it
				match = link;
			}
		}
	}

	return match ? match.href : null;
};

// EXPORTED
// correctly joins together to url segments
local.web.joinUrl = function joinUrl() {
	var parts = Array.prototype.map.call(arguments, function(arg) {
		var lo = 0, hi = arg.length;
		if (arg == '/') return '';
		if (arg.charAt(0) === '/')      { lo += 1; }
		if (arg.charAt(hi - 1) === '/') { hi -= 1; }
		return arg.substring(lo, hi);
	});
	return parts.join('/');
};

// EXPORTED
// parseUri 1.2.2, (c) Steven Levithan <stevenlevithan.com>, MIT License
local.web.parseUri = function parseUri(str) {
	if (typeof str === 'object') {
		if (str.url) { str = str.url; }
		else if (str.host || str.path) { str = local.web.joinUrl(req.host, req.path); }
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
		return "event: "+obj.event+"\r\ndata: "+JSON.stringify(obj.data)+"\r\n\r\n";
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
	if (data)
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
	if (data)
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
// - `request.stream`: boolean, stream the response? If falsey, will buffer and deserialize the response
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

	// if not given a local.web.Request, make one and remember to end the request ourselves
	var body = null, selfEnd = false;
	if (!(request instanceof local.web.Request)) {
		body = request.body;
		request = new local.web.Request(request);
		selfEnd = true; // we're going to end()
	}

	// parse the url scheme
	var scheme, firstColonIndex = request.url.indexOf(':');
	if (firstColonIndex === -1)
		scheme = 'http'; // default for relative paths
	else
		scheme = request.url.slice(0, firstColonIndex);

	// wire up the response with the promise
	var response_ = local.promise();
	var response = new local.web.Response();
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
});// Events
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
		var urld  = local.web.parseUri(this.url);
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
	var urld          = local.web.parseUri(this.url);
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
	this.authHeader      = null;

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
local.web.Navigator = Navigator;

// sets an auth header value to be used in all requests (when no auth is given in the request)
Navigator.prototype.setAuthHeader = function(v) {
	this.authHeader = v;
};

// executes an HTTP request to our context
//  - uses additional parameters on the request options:
//    - retry: bool, should the url resolve be tried if it previously failed?
//    - noresolve: bool, should we use the url we have and not try to resolve one from our parent's links?
Navigator.prototype.dispatch = function Navigator__dispatch(req) {
	if (!req || !req.method) { throw "request options not provided"; }
	var self = this;

	if (!req.headers.authorization && this.authHeader)
		req.headers.authorization = this.authHeader;

	var response = local.promise();
	((req.noresolve) ? local.promise(this.context.getUrl()) : this.resolve({ retry:req.retry, nohead:true }))
		.succeed(function(url) {
			req.url = url;
			return local.web.dispatch(req);
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
Navigator.prototype.subscribe = function Navigator__subscribe(opts) {
	var self = this;
	if (!opts) opts = {};
	if (!opts.headers) opts.headers = {};
	return this.resolve()
		.succeed(function(url) {
			opts.url = url;
			if (!opts.headers.authorization && self.authHeader)
				opts.headers.authorization = self.authHeader;
			return local.web.subscribe(opts);
		});
};

// follows a link relation from our context, generating a new navigator
//  - uses URI Templates to generate links
//  - first looks for a matching rel and id
//    eg relation('item', 'foobar'), Link: <http://example.com/some/foobar>; rel="item"; id="foobar" -> http://example.com/some/foobar
//  - then looks for a matching rel with no id and uses that to generate the link
//    eg relation('item', 'foobar'), Link: <http://example.com/some/{id}>; rel="item" -> http://example.com/some/foobar
//  - `extraParams` are any other URI template substitutions which should occur
//    eg relation('item', 'foobar', { limit:5 }), Link: <http://example.com/some/{id}{?limit}>; rel="item" -> http://example.com/some/foobar?limit=5
Navigator.prototype.relation = function Navigator__relation(rel, id, extraParams) {
	var params = extraParams || {};
	params.id = (id || '').toLowerCase();

	var child = new Navigator(new NavigatorContext(rel, params), this);
	if (this.authHeader)
		child.setAuthHeader(this.authHeader);
	return child;
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
				var response = new local.web.Response();
				response.writeHead(404, 'link relation not found').end();
				resolvedPromise.reject(response);
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
//  - first looks for a matching rel and id
//    eg item('foobar') -> Link: <http://example.com/some/foobar>; rel="item"; id="foobar" -> http://example.com/some/foobar
//  - then looks for a matching rel with no id and uses that to generate the link
//    eg item('foobar') -> Link: <http://example.com/some/{item}>; rel="item" -> http://example.com/some/foobar
Navigator.prototype.__lookupLink = function Navigator__lookupLink(context) {
	// try to find the link with a id equal to the param we were given
	var href = local.web.lookupLink(this.links, context.rel, context.relparams.id);

	if (href) {
		var url = local.web.UriTemplate.parse(href).expand(context.relparams);
		var urld = local.web.parseUri(url);
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
local.web.navigator = function(urlOrNavOrLinks, optRel, optId) {
	if (urlOrNavOrLinks instanceof Navigator)
		return urlOrNavOrLinks;
	var url;
	if (Array.isArray(urlOrNavOrLinks))
		url = local.web.lookupLink(urlOrNavOrLinks, optRel, optId);
	else
		url = urlOrNavOrLinks;
	return new Navigator(url);
};})();// Local Client Behaviors
// ======================
// pfraze 2013

if (typeof this.local == 'undefined')
	this.local = {};
if (typeof this.local.client == 'undefined')
	this.local.client = {};

(function() {// Helpers
// =======

// EXPORTED
// searches up the node tree for an element
function findParentNode(node, test) {
	while (node) {
		if (test(node)) { return node; }
		node = node.parentNode;
	}
	return null;
}

findParentNode.byTag = function(node, tagName) {
	return findParentNode(node, function(elem) {
		return elem.tagName == tagName;
	});
};

findParentNode.byClass = function(node, className) {
	return findParentNode(node, function(elem) {
		return elem.classList && elem.classList.contains(className);
	});
};

findParentNode.byElement = function(node, element) {
	return findParentNode(node, function(elem) {
		return elem === element;
	});
};

findParentNode.thatisFormRelated = function(node) {
	return findParentNode(node, function(elem) {
		return !!elem.form;
	});
};

// combines parameters as objects
// - precedence is rightmost
//     reduceObjects({a:1}, {a:2}, {a:3}) => {a:3}
function reduceObjects() {
	var objs = Array.prototype.slice.call(arguments);
	var acc = {}, obj;
	while (objs.length) {
		obj = objs.shift();
		if (!obj) { continue; }
		for (var k in obj) {
			if (typeof obj[k] == 'undefined' || obj[k] === null) { continue; }
			if (typeof obj[k] == 'object' && !Array.isArray(obj[k])) {
				acc[k] = reduceObjects(acc[k], obj[k]);
			} else {
				acc[k] = obj[k];
			}
		}
	}
	return acc;
}

// INTERNAL
// dispatches a request event, stopping the given event
function dispatchRequestEvent(targetElem, request) {
	var re = new CustomEvent('request', { bubbles:true, cancelable:true, detail:request });
	targetElem.dispatchEvent(re);
}

// INTERNAL
// submit helper, makes it possible to find the button which triggered the submit
function trackFormSubmitter(node) {
	var elem = findParentNode.thatisFormRelated(node);
	if (elem) {
		for (var i=0; i < elem.form.length; i++) {
			elem.form[i].setAttribute('submitter', null);
		}
		elem.setAttribute('submitter', '1');
	}
}

// EXPORTED
// extracts request from any given element
function extractRequest(targetElem, containerElem) {
	var requests = { form:{}, fieldset:{}, elem:{} };
	var fieldset = null, form = null;

	// find parent fieldset
	if (targetElem.tagName === 'FIELDSET') {
		fieldset = targetElem;
	} else if (targetElem.tagName !== 'FORM') {
		fieldset = findParentNode.byTag(targetElem, 'FIELDSET');
	}

	// find parent form
	if (targetElem.tagName === 'FORM') {
		form = targetElem;
	} else {
		// :TODO: targetElem.form may be a simpler alternative
		var formId = targetElem.getAttribute('form') || (fieldset ? fieldset.getAttribute('form') : null);
		if (formId) {
			form = containerElem.querySelector('#'+formId);
		}
		if (!form) {
			form = findParentNode.byTag(targetElem, 'FORM');
		}
	}

	// extract payload
	var payload = extractRequestPayload(targetElem, form);

	// extract form headers
	if (form) {
		requests.form = extractRequest.fromForm(form, targetElem);
	}

	// extract fieldset headers
	if (fieldset) {
		requests.fieldset = extractRequest.fromFormElement(fieldset);
	}

	// extract element headers
	if (targetElem.tagName === 'A') {
		requests.elem = extractRequest.fromAnchor(targetElem);
	} else if (['FORM','FIELDSET'].indexOf(targetElem.tagName) === -1) {
		requests.elem = extractRequest.fromFormElement(targetElem);
	}

	// combine then all, with precedence given to rightmost objects in param list
	var req = reduceObjects(requests.form, requests.fieldset, requests.elem);
	var payloadWrapper = {};
	payloadWrapper[/GET/i.test(req.method) ? 'query' : 'body'] = payload;
	return reduceObjects(req, payloadWrapper);
}

// EXPORTED
// extracts request parameters from an anchor tag
extractRequest.fromAnchor = function(node) {

	// get the anchor
	node = findParentNode.byTag(node, 'A');
	if (!node || !node.attributes.href || node.attributes.href.value.charAt(0) == '#') { return null; }

	// pull out params
	var request = {
		// method  : 'get',
		url     : node.attributes.href.value,
		target  : node.getAttribute('target'),
		headers : { accept:node.getAttribute('type') }
	};
	return request;
};

// EXPORTED
// extracts request parameters from a form element (inputs, textareas, etc)
extractRequest.fromFormElement = function(node) {
	// :TODO: search parent for the form-related element?
	//        might obviate the need for submitter-tracking

	// pull out params
	var request = {
		method  : node.getAttribute('formmethod'),
		url     : node.getAttribute('formaction'),
		target  : node.getAttribute('formtarget'),
		headers : {
			'content-type' : node.getAttribute('formenctype'),
			accept         : node.getAttribute('formaccept')
		}
	};
	return request;
};

// EXPORTED
// extracts request parameters from a form
extractRequest.fromForm = function(form, submittingElem) {

	// find the submitter, if the submitting element is not form-related
	if (submittingElem && !submittingElem.form) {
		for (var i=0; i < form.length; i++) {
			var elem = form[i];
			if (elem.getAttribute('submitter') == '1') {
				submittingElem = elem;
				elem.setAttribute('submitter', '0');
				break;
			}
		}
	}

	var requests = { submitter:{}, form:{} };
	// extract submitting element headers
	if (submittingElem) {
		requests.submitter = {
			method  : submittingElem.getAttribute('formmethod'),
			url     : submittingElem.getAttribute('formaction'),
			target  : submittingElem.getAttribute('formtarget'),
			headers : {
				'content-type' : submittingElem.getAttribute('formenctype'),
				accept         : submittingElem.getAttribute('formaccept')
			}
		};
	}
	// extract form headers
	requests.form = {
		method  : form.getAttribute('method'),
		url     : form.getAttribute('action'),
		target  : form.getAttribute('target'),
		headers : {
			'content-type' : form.getAttribute('enctype') || form.enctype,
			'accept'       : form.getAttribute('accept')
		}
	};
	if (form.acceptCharset) { requests.form.headers.accept = form.acceptCharset; }

	// combine, with precedence to the submitting element
	var request = reduceObjects(requests.form, requests.submitter);

	// strip the base URI
	// :TODO: needed?
	/*var base_uri = window.location.href.split('#')[0];
	if (target_uri.indexOf(base_uri) != -1) {
		target_uri = target_uri.substring(base_uri.length);
		if (target_uri.charAt(0) != '/') { target_uri = '/' + target_uri; }
	}*/

	return request;
};

// EXPORTED
// serializes all form elements beneath and including the given element
// - `targetElem`: container element, will reject the field if not within (optional)
// - `form`: an array of HTMLElements or a form field (they behave the same for iteration)
// - `opts.nofiles`: dont try to read files in file fields? (optional)
function extractRequestPayload(targetElem, form, opts) {
	if (!opts) opts = {};

	// iterate form elements
	var data = {};
	if (!opts.nofiles)
		data.__fileReads = []; // an array of promises to read <input type=file>s
	for (var i=0; i < form.length; i++) {
		var elem = form[i];

		// skip if it doesnt have a name
		if (!elem.name)
			continue;

		// skip if not a child of the target element
		if (targetElem && !findParentNode.byElement(elem, targetElem))
			continue;

		// pull value if it has one
		var isSubmittingElem = elem.getAttribute('submitter') == '1';
		if (elem.tagName === 'BUTTON') {
			if (isSubmittingElem) {
				// don't pull from buttons unless recently clicked
				data[elem.name] = elem.value;
			}
		} else if (elem.tagName === 'INPUT') {
			switch (elem.type.toLowerCase()) {
				case 'button':
				case 'submit':
					if (isSubmittingElem) {
						// don't pull from buttons unless recently clicked
						data[elem.name] = elem.value;
					}
					break;
				case 'checkbox':
					if (elem.checked) {
						// don't pull from checkboxes unless checked
						data[elem.name] = (data[elem.name] || []).concat(elem.value);
					}
					break;
				case 'radio':
					if (elem.getAttribute('checked') !== null) {
						// don't pull from radios unless selected
						data[elem.name] = elem.value;
					}
					break;
				case 'file':
					// read the files
					if (opts.nofiles)
						break;
					if (elem.multiple) {
						for (var i=0, f; f = elem.files[i]; i++)
							readFile(data, elem, elem.files[i], i);
						data[elem.name] = [];
						data[elem.name].length = i;
					} else {
						readFile(data, elem, elem.files[0]);
					}
					break;
				default:
					data[elem.name] = elem.value;
					break;
			}
		} else
			data[elem.name] = elem.value;
	}

	return data;
}

// INTERNAL
// file read helpers
function readFile(data, elem, file, index) {
	var reader = new FileReader();
	reader.onloadend = readFileLoadEnd(data, elem, file, index);
	reader.readAsDataURL(file);
}
function readFileLoadEnd(data, elem, file, index) {
	// ^ this avoids a closure circular reference
	var promise = local.promise();
	data.__fileReads.push(promise);
	return function(e) {
		var obj = {
			content: e.target.result || null,
			name: file.name,
			formattr: elem.name,
			size: file.size,
			type: file.type,
			lastModifiedDate: file.lastModifiedDate
		};
		if (typeof index != 'undefined')
			obj.formindex = index;
		promise.fulfill(obj);
	};
}
function finishPayloadFileReads(request) {
	var fileReads = (request.body) ? request.body.__fileReads :
					((request.query) ? request.query.__fileReads : []);
	return local.promise.bundle(fileReads).then(function(files) {
		if (request.body) delete request.body.__fileReads;
		if (request.query) delete request.query.__fileReads;
		files.forEach(function(file) {
			if (typeof file.formindex != 'undefined')
				request.body[file.formattr][file.formindex] = file;
			else request.body[file.formattr] = file;
		});
		return request;
	});
}

local.client.findParentNode = findParentNode;
local.client.extractRequest = extractRequest;
local.client.extractRequestPayload = extractRequestPayload;
local.client.finishPayloadFileReads = finishPayloadFileReads;// Standard DOM Events
// ===================

// listen()
// ========
// EXPORTED
// Converts 'click', 'submit', and 'drag/drop' events into custom 'request' events
// - within the container, all 'click' and 'submit' events will be consumed
// - 'request' events will be dispatched by the original dispatching element
// - draggable elements which produce requests (anchors, form elements) have their drag/drop handlers defined as well
// Parameters:
// - `container` must be a valid DOM element
// - `options` may disable event listeners by setting `links`, `forms`, or `dragdrops` to false
function LocalClient__listen(container, options) {
	// :TODO: come up with an iframe-compliant test
	// if (!container || !(container instanceof Element)) {
	// 	throw "Listen() requires a valid DOM element as a first parameter";
	// }

	container.__eventHandlers = [];
	options = options || {};

	var handler;
	if (options.links !== false) {
		handler = { name:'click', handleEvent:LocalClient__clickHandler, container:container };
		container.addEventListener('click', handler, true);
		container.__eventHandlers.push(handler);
	}
	if (options.forms !== false) {
		handler = { name:'submit', handleEvent:LocalClient__submitHandler, container:container };
		container.addEventListener('submit', handler, true);
	}
	// :DEBUG: disabled for now
	/*if (options.dragdrops !== false) {
		handler = { name:'dragstart', handleEvent:LocalClient__dragstartHandler, container:container };
		container.addEventListener('dragstart', handler);
		container.__eventHandlers.push(handler);
	}*/
}

// unlisten()
// ==========
// EXPORTED
// Stops listening to 'click', 'submit', and 'drag/drop' events
function LocalClient__unlisten(container) {
	if (container.__eventHandlers) {
		container.__eventHandlers.forEach(function(handler) {
			container.removeEventListener(handler.name, handler);
		});
		delete container.__eventHandlers;
	}
	var subscribeElems = container.querySelectorAll('[data-subscribe]');
	Array.prototype.forEach.call(subscribeElems, function(subscribeElem) {
		if (subscribeElem.__subscriptions) {
			for (var url in subscribeElem.__subscriptions)
				subscribeElem.__subscriptions[url].close();
			delete subscribeElem.__subscriptions;
		}
	});
}

// INTERNAL
// transforms click events into request events
function LocalClient__clickHandler(e) {
	if (e.button !== 0) { return; } // handle left-click only
	trackFormSubmitter(e.target);
	var request = extractRequest.fromAnchor(e.target);
	if (request && ['_top','_blank'].indexOf(request.target) !== -1) { return; }
	if (request) {
		e.preventDefault();
		e.stopPropagation();
		dispatchRequestEvent(e.target, request);
		return false;
	}
}

// INTERNAL
// transforms submit events into request events
function LocalClient__submitHandler(e) {
	var request = extractRequest(e.target, this.container);
	if (request && ['_top','_blank'].indexOf(request.target) !== -1) { return; }
	if (request) {
		e.preventDefault();
		e.stopPropagation();
		finishPayloadFileReads(request).then(function() {
			dispatchRequestEvent(e.target, request);
		});
		return false;
	}
}

// INTERNAL
// builds a 'link' object out of a dragged item
function LocalClient__dragstartHandler(e) {
	e.dataTransfer.effectAllowed = 'none'; // allow nothing unless there's a valid link
	var link = null, elem = e.target;

	// update our form submitter tracking
	trackFormSubmitter(elem);

	// get request data
	if (elem.tagName == 'A') {
		link = extractRequest.fromAnchor(elem);
	} else if (elem.form) {
		link = extractRequest(elem.form, this.container);
	} /* :TODO: do we need to include fieldsets here? */

	// setup drag/drop behavior
	if (link) {
		e.dataTransfer.effectAllowed = 'link';
		e.dataTransfer.setData('application/request+json', JSON.stringify(link));
		e.dataTransfer.setData('text/uri-list', link.url);
		e.dataTransfer.setData('text/plain', link.url);
	}
}

local.client.listen = LocalClient__listen;
local.client.unlisten = LocalClient__unlisten;// Response Interpretation
// =======================

// supported on* events
var attrEvents = ['blur', 'change', 'click', 'dblclick', 'focus', 'keydown', 'keypress', 'keyup',
	'load', 'mousedown', 'mousemove', 'mouseout', 'mouseover', 'mouseup', 'reset', 'select', 'submit', 'unload'];

// renderResponse()
// ==============
// EXPORTED
// replaces the targetElem's innerHTML with the response payload
function renderResponse(targetElem, containerElem, response) {

	response.body = response.body || '';
	var type = response.headers['content-type'];
	if (/application\/html\-deltas\+json/.test(type)) {
		if (typeof response.body != 'object' || !Array.isArray(response.body))
			console.log('Improperly-formed application/html-deltas+json object', response);
		else {
			if (Array.isArray(response.body[0])) {
				response.body.forEach(function(delta) {
					renderHtmlDelta(delta, targetElem, containerElem);
				});
			} else
				renderHtmlDelta(response.body, targetElem, containerElem);
		}
	} else {
		// format the output by type
		var html = '';
		if (/text\/html/.test(type))
			html = response.body.toString();
		else {
			// escape non-html so that it can render correctly
			html = (typeof response.body != 'string') ? JSON.stringify(response.body, null, 2) : response.body;
			html = '<pre>'+html.replace(/</g, '&lt;').replace(/>/g, '&gt;')+'</pre>';
		}

		local.client.unlisten(targetElem); // make sure to unregister listeners before replaceing
		targetElem.innerHTML = html;
		local.env.postProcessRegion(targetElem, containerElem);
	}

	bindAttrEvents(targetElem, containerElem);
	subscribeElements(targetElem, containerElem);
}

function renderHtmlDelta(delta, targetElem, containerElem) {
	if (typeof delta != 'object' || !Array.isArray(delta))
		return;
	var i, ii, region;
	var op = delta.shift(), selector = delta.shift(), args = delta;
	if (!op || !selector)
		return;
	var elems = containerElem.querySelectorAll(selector);
	var addClass = function(cls) { elems[i].classList.add(cls); };
	var removeClass = function(cls) { elems[i].classList.remove(cls); };
	var toggleClass = function(cls) { elems[i].classList.toggle(cls); };
	for (i=0, ii=elems.length; i < ii; i++) {
		if (!elems[i]) continue;
		var elem = elems[i];
		switch (op) {
			case 'replace':
				local.client.unlisten(elem); // destructive update, do unlisten
				elem.innerHTML = args[0];
				local.env.postProcessRegion(elem, containerElem);
				break;
			case 'remove':
				local.client.unlisten(elem); // destructive update, do unlisten
				elem.parentNode.removeChild(elem);
				break;
			case 'append':
				elem.innerHTML = elem.innerHTML + args[0];
				local.env.postProcessRegion(elem, containerElem);
				break;
			case 'prepend':
				elem.innerHTML = args[0] + elem.innerHTML;
				local.env.postProcessRegion(elem, containerElem);
				break;
			case 'addClass':
				if (elem.classList)
					(args[0]||'').split(' ').forEach(addClass);
				break;
			case 'removeClass':
				if (elem.classList)
					(args[0]||'').split(' ').forEach(removeClass);
				break;
			case 'toggleClass':
				if (elem.classList)
					(args[0]||'').split(' ').forEach(toggleClass);
				break;
			case 'setAttribute':
				if (args[0])
					elem.setAttribute(args[0], args[1]);
				break;
			case 'navigate':
				region = local.env.getClientRegion(elem.id);
				if (region)
					region.dispatchRequest(args[0]);
				else
					console.log('html-delta navigate targeted non-client-region element', elem, selector);
				break;
		}
	}
}

// INTERNAL
// searches elements for event attributes (on*) and binds a listener which dispatches a request event
// - attribute value determines the request method (post, put, patch, etc)
function bindAttrEvents(targetElem, containerElem) {

	// find all elements with on* attributes
	attrEvents.forEach(function(eventName) {
		var eventAttr = 'on'+eventName;
		var elements = targetElem.querySelectorAll('['+eventAttr+']');
		Array.prototype.forEach.call(elements, function(elem) {
			// bind event handlers based on the given model
			var method = elem.getAttribute(eventAttr);
			elem.addEventListener(eventName, makeAttrEventHandler(method, containerElem));
			elem.removeAttribute(eventAttr);
		});
	});
}

// INTERNAL
// provides an event handler which dispatches a request event
function makeAttrEventHandler(method, containerElem) {
	return function(e) {
		e.preventDefault();
		e.stopPropagation();

		// build request
		var request = extractRequest(e.currentTarget, containerElem);
		request.method = method;
		finishPayloadFileReads(request).then(function() {

			// move the query into the body if not a GET
			// (extractRequest would have used the wrong method to judge this)
			var isGET = /GET/i.test(method);
			if (!isGET && !request.body) {
				request.body = request.query;
				request.query = {};
			}
			// visa-versa
			else if (isGET && request.body) {
				request.query = reduceObjects(request.body, request.query);
				request.body = {};
			}

			// dispatch request event
			dispatchRequestEvent(e.target, request);
		});
	};
}

// INTERNAL
// subscribes all child elements with 'data-subscribe' to 'update' events coming from specified url
// - when the update message is received, will issue a GET request for new HTML
function subscribeElements(targetElem, containerElem) {

	// find subscribe elems
	var subscribeElems = targetElem.querySelectorAll('[data-subscribe]');

	Array.prototype.forEach.call(subscribeElems, function(subscribeElem) {
		// subscribe to server's events
		var subParts = subscribeElem.dataset.subscribe.split(' ');
		var eventsUrl = subParts[0];
		var getUrl = subParts[1] || eventsUrl;

		subscribeElem.__subscriptions = subscribeElem.__subscriptions || {};
		var stream = subscribeElem.__subscriptions[eventsUrl];
		if (!stream) {
			stream = subscribeElem.__subscriptions[eventsUrl] = local.web.subscribe({ url:eventsUrl });
			stream.on('update', makeUpdateEventHandler(getUrl, subscribeElem));
			stream.on('error', makeErrorEventHandler());
		}
	});
}

function makeUpdateEventHandler(url, targetElem) {
	return function(m) {
		var request = { method:'get', url:url, target:"_element", headers:{ accept:'text/html' }};
		if (targetElem.tagName == 'FORM') {
			// serialize the form values in the query
			request.query = extractRequestPayload(targetElem, targetElem, { nofiles:true });
			// see if the form has its own accept
			request.headers.accept = targetElem.getAttribute('accept') || 'text/html';
		}
		dispatchRequestEvent(targetElem, request);
	};
}

function makeErrorEventHandler() {
	return function(e) {
		var err = e.data;
		console.log('Client update stream error:', err);
	};
}

local.client.renderResponse = renderResponse;// Regions
// =======

if (typeof CustomEvent === 'undefined') {
	// CustomEvent shim (safari)
	// thanks to netoneko https://github.com/maker/ratchet/issues/101
	CustomEvent = function(type, eventInitDict) {
		var event = document.createEvent('CustomEvent');

		event.initCustomEvent(type, eventInitDict['bubbles'], eventInitDict['cancelable'], eventInitDict['detail']);
		return event;
	};
}

// EXPORTED
// an isolated browsing context in the DOM
// - `id` indicates the element to add Region behaviors to
function Region(id) {
	this.id = id;
	this.context = {
		url   : '',
		urld  : {},
		links : [],
		type  : '' // content type of the response
	};

	this.element = document.getElementById(id);
	if (!this.element) { throw "Region target element not found"; }
	this.element.classList.add('client-region');

	this.listenerFn = handleRequest.bind(this);
	this.element.addEventListener('request', this.listenerFn);
	local.client.listen(this.element);
}
local.client.Region = Region;

// dispatches a 'request' DOM event, which the region will then catch and HTTP-dispatch
// - targetEl: optional, the element to dispatch from (defaults to client region's element)
//             (must be a child element)
Region.prototype.dispatchRequest = function(request, targetEl) {
	if (typeof request === 'string')
		request = { method:'get', url:request, headers:{ accept:'text/html' }};
	if (!targetEl)
		targetEl = this.element;
	var re = new CustomEvent('request', { bubbles:true, cancelable:true, detail:request });
	targetEl.dispatchEvent(re);
};

// removes the Region behaviors from the given element
Region.prototype.terminate = function() {
	local.client.unlisten(this.element);
	this.element.removeEventListener('request', this.listenerFn);
};

// handles the 'request' DOM event by firing the HTTP request and handling the response
function handleRequest(e) {
	e.preventDefault();
	e.stopPropagation();

	var request = e.detail;
	this.__prepareRequest(request);

	var self = this;
	var handleResponse = function(response) { self.__handleResponse(e, request, response); };
	local.web.dispatch(request, this).then(handleResponse, handleResponse);
}

// prepares data from a 'request' DOM event for HTTP dispatch
Region.prototype.__prepareRequest = function(request) {
	// sane defaults
	request.headers = request.headers || {};
	request.headers.accept = request.headers.accept || 'text/html';
	request.stream = false;

	// relative urls
	var urld = local.web.parseUri(request);
	if (!urld.protocol) {
		// build a new url from the current context
		var newUrl;
		if (request.url.length > 0 && request.url.charAt(0) != '/') {
			// relative to context dirname
			newUrl = this.context.urld.protocol + "://" + this.context.urld.host + this.context.urld.directory + request.url;
		} else {
			// relative to context hostLink
			newUrl = this.context.urld.protocol + "://" + this.context.urld.host + request.url;
		}
		// reduce the string's '..' relatives
		// :TODO: I'm sure there's a better algorithm for this
		var lastRequestHost = this.context.urld.host;
		do {
			request.url = newUrl;
			newUrl = request.url.replace(/[^\/]+\/\.\.\//i, '');
		} while (newUrl != request.url && local.web.parseUri(newUrl).host == lastRequestHost);
		delete request.host;
		delete request.path;
	}
};

// applies an HTTP response to its target element
Region.prototype.__handleResponse = function(e, request, response) {
	response.headers = response.headers || {};
	var requestTarget = this.__chooseRequestTarget(e, request);
	if (!requestTarget)
		return;

	var targetClient = local.env.getClientRegion(requestTarget.id);
	if (targetClient)
		targetClient.__updateContext(request, response);

	// react to the response
	switch (response.status) {
		case 204:
			// no content
			break;
		case 205:
			// reset form
			// :TODO: should this try to find a parent form to requestTarget?
			if (requestTarget.tagName === 'FORM')
				requestTarget.reset();
			break;
		case 303:
			// dispatch for contents
			var request2 = { method:'get', url:response.headers.location, headers:{ accept:'text/html' }};
			this.dispatchRequest(request2);
			break;
		default:
			// replace target innards
			local.client.renderResponse(requestTarget, this.element, response);
	}
};

Region.prototype.__updateContext = function(request, response) {
	// track location for relative urls
	var urld = local.web.parseUri(request);
	this.context.urld  = urld;
	this.context.url   = urld.protocol + '://' + urld.authority + urld.directory;
	this.context.links = response.headers.link;
	this.context.type  = response.headers['content-type'];
};

Region.prototype.__chooseRequestTarget = function(e, request) {
	if (request.target == '_element')
		return e.target;
	return document.getElementById(request.target) || this.element;
};})();// Local Environment
// =================
// pfraze 2013

if (typeof this.local == 'undefined')
	this.local = {};
if (typeof this.local.env == 'undefined')
	this.local.env = {};

(function() {// Env Worker
// ==========

(function () {
	var __cur_cid = 1;
	function gen_cid() { return __cur_cid++; }
	var __cur_mid = 1;
	function gen_mid() { return __cur_mid++; }

	// Worker
	// ======
	// EXPORTED
	// wraps a Web Worker API tools for sandboxing and messaging
	// - loads the worker with the bootstrap script
	// - `options.bootstrapUrl` may optionally specify the URL of the worker bootstrap script
	// - `options.log` will enable logging of all message traffic
	// - `options.shared` will use SharedWorker instead of WebWorker
	// - `options.namespace` will set the `name` of SharedWorker, if applicable
	function LocalEnvWorker(options) {
		options = options || {};
		this.isLogging = options.log;
		this.isShared = options.shared;

		this.exchanges = {};
		this.exchangeListeners = {};

		// operations stream - open by default on both ends
		this.ops = 0;
		this.exchanges[this.ops] = { topic: null, messageListeners: {} };

		// suspension
		this.suspendedTopics = [];
		this.messageBuffers = {};

		if (this.isShared) {
			this.worker = new SharedWorker(options.bootstrapUrl || 'worker.js', options.namespace);
			this.worker.port.start();
		} else
			this.worker = new Worker(options.bootstrapUrl || 'worker.js');
		setupMessagingHandlers.call(this);
	}
	local.env.Worker = LocalEnvWorker;

	LocalEnvWorker.prototype.getPort = function() {
		return this.worker.port ? this.worker.port : this.worker;
	};


	// control api
	// -

	// EXPORTED
	// instructs the LocalEnvWorker to set the given name to null
	// - eg LocalEnvWorker.nullify('XMLHttpRequest'); // no ajax
	LocalEnvWorker.prototype.nullify = function(name) {
		this.sendMessage(this.ops, 'nullify', name);
	};

	// EXPORTED
	// instructs the LocalEnvWorker to import the JS given by the URL
	// - eg LocalEnvWorker.importJS('/my/script.js', onImported);
	// - `urls`: required string|array[string]
	// - `cb`: optional function(message), called on load/fail
	// - `urls` may contain data-urls of valid JS
	LocalEnvWorker.prototype.importScripts = function(urls, cb) {
		var exImportScripts = this.startExchange('importScripts');
		if (cb)
			this.onMessage(exImportScripts, 'done', cb);
		this.sendMessage(exImportScripts, 'urls', urls);
		// exImportScripts will be closed by the worker after sending 'done'
	};

	// EXPORTED
	// destroys the LocalEnvWorker
	LocalEnvWorker.prototype.terminate = function() {
		delete this.exchanges;
		delete this.exchangeListeners;
		delete this.suspendedTopics;
		delete this.messageBuffers;
		this.worker.terminate();
		this.worker = null;
	};


	// exchange & messaging api
	// -

	// INTERNAL
	// registers listeners required for messaging
	function setupMessagingHandlers() {
		// native message handler
		this.getPort().addEventListener('message', (function(event) {
			var message = event.data;
			if (!message)
				return console.error('Invalid message from worker: Payload missing', message);
			if (typeof message.id == 'undefined')
				return console.error('Invalid message from worker: `id` missing', message);
			if (typeof message.exchange == 'undefined')
				return console.error('Invalid message from worker: `exchange` missing', message);
			if (!message.label)
				return console.error('Invalid message from worker: `label` missing', message);

			if (this.isLogging) { console.log('receiving', message); }

			// exchanges from the worker use negative IDs (to avoid collisions)
			message.exchange = parseInt(message.exchange, 10);
			if (message.exchange !== this.ops) // (except the ops channel)
				message.exchange = -message.exchange;

			// notify onMessage listeners
			emitOnMessage.call(this, message);
		}).bind(this));

		// new exchange handler
		this.onMessage(this.ops, 'open_exchange', (function(message) {
			if (!message.data)
				return console.error('Invalid ops-exchange "open_exchange" message from worker: Payload missing', message);
			if (!message.data.topic)
				return console.error('Invalid ops-exchange "open_exchange" message from worker: `topic` missing', message);
			if (typeof message.data.exchange == 'undefined')
				return console.error('Invalid ops-exchange "open_exchange" message from worker: `exchange` missing', message);

			if (this.isLogging) { console.log('open exchange', message); }

			// exchanges from the worker use negative IDs (to avoid collisions)
			message.data.exchange = -parseInt(message.data.exchange, 10);
			this.exchanges[message.data.exchange] = { topic: message.data.topic, messageListeners: {}, metaData: {} };

			// notify onExchange listeners
			emitOnExchange.call(this, message.data.topic, message.data.exchange);
		}).bind(this));

		// end exchange handler
		this.onMessage(this.ops, 'close_exchange', (function(message) {
			var exchange = -parseInt(message.data, 10);
			if (exchange === 0)
				return console.error('Invalid ops-exchange "close_exchange" message from worker: Cannot close "ops" exchange', message);
			else if (!exchange)
				return console.error('Invalid ops-exchange "close_exchange" message from worker: Payload missing', message);
			if (!(exchange in this.exchanges))
				return console.error('Invalid ops-exchange "close_exchange" message from worker: Invalid exchange id', message);

			if (this.isLogging) { console.log('close exchange', message); }

			this.removeAllMessageListeners(exchange);
			delete this.exchanges[exchange];
			if (exchange in this.messageBuffers)
				delete this.messageBuffers[exchange];
		}).bind(this));
	}

	// EXPORTED
	// starts a new bidirectional message stream
	// - sends the 'open_exchange' message on the operations exchange
	// - `topic`: required string, a label for the exchange
	LocalEnvWorker.prototype.startExchange = function(topic) {
		var exchange = gen_cid();
		this.exchanges[exchange] = { topic: topic, messageListeners: {}, metaData: {} };
		this.sendMessage(this.ops, 'open_exchange', { exchange: exchange, topic: topic });

		if (this.isExchangeTopicSuspended(topic))
			this.suspendExchange(exchange);

		return exchange;
	};

	// EXPORTED
	// ends the message stream, signaling the close on the other end
	// - sends the 'close_exchange' message on the operations exchange
	//   and 'close' on the given exchange, and broadcasts the 'close' message
	//   on the local exchange listeners
	// - `exchange`: required number, an ID given by `startExchange()` or `onExchange()`
	LocalEnvWorker.prototype.endExchange = function(exchange) {
		if (!(exchange in this.exchanges))
			return;

		// broadcast 'close' locally
		emitOnMessage.call(this, {
			id       : gen_mid(),
			exchange : exchange,
			label    : 'close'
		});

		this.sendMessage(exchange, 'close');
		this.sendMessage(this.ops, 'close_exchange', exchange);

		this.removeAllMessageListeners(exchange);
		delete this.exchanges[exchange];
		if (exchange in this.messageBuffers)
			delete this.messageBuffers[exchange];
	};

	// EXPORTED
	// adds data to the exchange to be used in callbacks
	// - `exchange`: required number
	// - `k`: required string
	// - `v`: required mixed
	LocalEnvWorker.prototype.setExchangeMeta = function(exchange, k, v) {
		if (exchange in this.exchanges)
			this.exchanges[exchange].metaData[k] = v;
	};

	// EXPORTED
	// gets data from the exchange
	// - `exchange`: required number
	// - `k`: required string
	LocalEnvWorker.prototype.getExchangeMeta = function(exchange, k, v) {
		if (exchange in this.exchanges)
			return this.exchanges[exchange].metaData[k];
		return null;
	};

	// EXPORTED
	// sends a message on an established exchange stream
	// - `exchange`: required number, an ID given by `startExchange()` or `onExchange()`
	// - `label`: required string, identifies the message type
	// - `data`: optional mixed, the content of the message
	LocalEnvWorker.prototype.sendMessage = function(exchange, label, data) {
		var message;
		if (typeof exchange == 'object')
			message = exchange;
		else {
			message = {
				id       : gen_mid(),
				exchange : exchange,
				label    : label,
				data     : data
			};
		}
		if (message.exchange in this.messageBuffers) {
			// dont send; queue message in the buffer
			this.messageBuffers[message.exchange].push(message);
		} else {
			if (this.isLogging) { console.log('sending', message); }
			this.getPort().postMessage(message);
		}
		return message.id;
	};

	// EXPORTED
	// registers a callback for handling new exchanges from the worker
	// - `topic`: required string, the exchange label
	// - `handler`: required function(exchange:number)
	LocalEnvWorker.prototype.onExchange = function(topic, handler) {
		if (!(topic in this.exchangeListeners))
			this.exchangeListeners[topic] = [];
		this.exchangeListeners[topic].push(handler);
	};

	// INTERNAL
	// calls 'new exchange' listeners
	function emitOnExchange(topic, exchange) {
		var listeners = this.exchangeListeners[topic];
		if (listeners) {
			listeners.forEach(function(listener) {
				listener(exchange);
			});
		}
	}

	// EXPORTED
	// removes a callback from the converation topic
	// - `topic`: required string, the exchange label
	// - `handler`: required function, the callback to remove
	LocalEnvWorker.prototype.removeExchangeListener = function(topic, handler) {
		if (topic in this.exchangeListeners) {
			var filterFn = function(listener) { return listener != handler; };
			this.exchangeListeners[topic] = this.exchangeListeners[topic].filter(filterFn);
			if (this.exchangeListeners[topic].length === 0)
				delete this.exchangeListeners[topic];
		}
	};

	// EXPORTED
	// removes all callbacks from the exchange topic
	// - `topic`: required string, the exchange label
	LocalEnvWorker.prototype.removeAllExchangeListeners = function(topic) {
		if (topic in this.exchangeListeners)
			delete this.exchangeListeners[topic];
	};

	// EXPORTED
	// signals a new message on an established exchange stream
	// - `exchange`: required number, an ID given by `startExchange()` or `onExchange()`
	// - `label`: required string, identifies the message type
	// - `handler`: required function(message:object, exchangeData:object)
	LocalEnvWorker.prototype.onMessage = function(exchange, label, handler) {
		var exchangeData = this.exchanges[exchange];
		if (!exchangeData)
			return console.error('Invalid `exchange` in onMessage() call: Not a valid ID', exchange);

		if (!(label in exchangeData.messageListeners))
			exchangeData.messageListeners[label] = [];
		exchangeData.messageListeners[label].push(handler);
	};

	// INTERNAL
	// calls 'on message' listeners
	function emitOnMessage(message) {
		if (message.exchange in this.exchanges) {
			var listeners = this.exchanges[message.exchange].messageListeners;
			if (message.label in listeners) {
				listeners[message.label].forEach(function(listener) {
					listener(message);
				});
			}
		}
	}

	// EXPORTED
	// removes a callback from a exchange's message listeners
	// - `exchange`: required number
	// - `label`: required string
	// - `handler`: required function
	LocalEnvWorker.prototype.removeMessageListener = function(exchange, label, handler) {
		var exchangeData = this.exchanges[exchange];
		if (!exchangeData)
			return console.warn('Invalid `exchange` in removeMessageListener() call: Not a valid ID', exchange);

		if (label in exchangeData.messageListeners) {
			var filterFn = function(listener) { return listener != handler; };
			exchangeData.messageListeners[label] = exchangeData.messageListeners[label].filter(filterFn);
			if (exchangeData.messageListeners[label].length === 0)
				delete exchangeData.messageListeners[label];
		}
	};

	// EXPORTED
	// - `exchange`: required number
	// - `label`: optional string
	// - if `label` is not given, removes all message listeners on the exchange
	LocalEnvWorker.prototype.removeAllMessageListeners = function(exchange, label) {
		var exchangeData = this.exchanges[exchange];
		if (!exchangeData)
			return console.warn('Invalid `exchange` in removeMessageListener() call: Not a valid ID', exchange);

		if (label) {
			if (label in exchangeData.messageListeners)
				delete exchangeData.messageListeners[label];
		} else
			exchangeData.messageListeners = {};
	};

	// EXPORTED
	// delays all messages of the given exchange until `resumeExchange` is called
	// - `exchange`: required number
	LocalEnvWorker.prototype.suspendExchange = function(exchange) {
		if (!(exchange in this.messageBuffers))
			this.messageBuffers[exchange] = [];
	};

	// EXPORTED
	// stops buffering and sends all queued messages in the exchange
	// - `exchange`: required number
	LocalEnvWorker.prototype.resumeExchange = function(exchange) {
		if (exchange in this.messageBuffers) {
			var buffer = this.messageBuffers[exchange];
			delete this.messageBuffers[exchange];
			buffer.forEach(this.sendMessage, this);
		}
	};

	// EXPORTED
	// - `exchange`: required number
	LocalEnvWorker.prototype.isExchangeSuspended = function(exchange) {
		return (exchange in this.messageBuffers);
	};

	// EXPORTED
	// delays all messages of the given exchange topic until `resumeExchangeTopic` is called
	// - `topic`: required string
	// - only suspends outgoing topics (not incoming)
	LocalEnvWorker.prototype.suspendExchangeTopic = function(topic) {
		if (this.suspendedTopics.indexOf(topic) === -1) {
			this.suspendedTopics.push(topic);
			for (var c in this.exchanges) {
				if (this.exchanges[c].topic == topic)
					this.suspendExchange(c);
			}
		}
	};

	// EXPORTED
	// stops buffering and sends all queued messages in the exchanges of the given `topic`
	// - `topic`: required string
	LocalEnvWorker.prototype.resumeExchangeTopic = function(topic) {
		var topicIndex = this.suspendedTopics.indexOf(topic);
		if (topicIndex !== -1) {
			this.suspendedTopics.splice(topicIndex, 1);
			for (var c in this.exchanges) {
				if (this.exchanges[c].topic == topic)
					this.resumeExchange(c);
			}
		}
	};

	// EXPORTED
	// - `topic`: required string
	LocalEnvWorker.prototype.isExchangeTopicSuspended = function(topic) {
		return this.suspendedTopics.indexOf(topic) !== -1;
	};
})();// Env Servers
// ===========

(function() {
	var __cur_id = 1;
	function gen_id() { return __cur_id++; }

	// Server
	// ======
	// EXPORTED
	// core type for all servers, should be used as a prototype
	function Server() {
		this.config = { id:gen_id(), domain:null };
	}
	local.env.Server = Server;

	// request handler, should be overwritten by subclasses
	Server.prototype.handleHttpRequest = function(request, response) {
		response.writeHead(0, 'server not implemented');
		response.end();
	};

	// called before server destruction, should be overwritten by subclasses
	// - executes syncronously - does not wait for cleanup to finish
	Server.prototype.terminate = function() {
	};

	// retrieve server source
	// - `requester` is the object making the request
	Server.prototype.getSource = function(requester) {
		return this.handleHttpRequest.toString();
	};


	// WorkerServer
	// ============
	// EXPORTED
	// wrapper for servers run within workers
	// - `config.src`: required URL
	// - `config.shared`: boolean, should the workerserver be shared?
	// - `config.namespace`: optional string, what should the shared worker be named?
	//   - defaults to `config.src` if undefined
	// - `loadCb`: optional function(message)
	function WorkerServer(config, loadCb) {
		config = config || {};
		Server.call(this);
		this.state = WorkerServer.BOOT;
		this.canLoadUserscript = false; // is the environment ready for us to load?
		this.hasHostPrivileges = true; // do we have full control over the worker?
		// ^ set to false by the ready message of a shared worker (if we're not the first page to connect)
		this.loadCb = loadCb;

		// merge config
		for (var k in config)
			this.config[k] = config[k];

		// prep config
		if (!this.config.src)
			this.config.src = '';
		if (!this.config.srcBaseUrl) {
			if (/^data/.test(this.config.src) === false) // scriptBaseUrl is used for relative-path require()s in the worker
				this.config.srcBaseUrl = this.config.src.replace(/\/[^/]+$/,'/');
			else
				this.config.srcBaseUrl = '';
		}
		if (!this.config.domain) // assign a temporary label for logging if no domain is given yet
			this.config.domain = '<'+this.config.src.slice(0,40)+'>';
		this.config.environmentHost = window.location.host;

		// initialize the web worker with the bootstrap script
		this.worker = new local.env.Worker({
			bootstrapUrl: local.env.config.workerBootstrapUrl,
			shared: config.shared || false,
			namespace: config.namespace || config.src
		});
		this.worker.suspendExchangeTopic('web_request'); // queue web requests until the app script is loaded
		this.worker.suspendExchangeTopic('web_subscribe'); // ditto for subscribes
		this.worker.onMessage(this.worker.ops, 'ready', this.onOpsWorkerReady.bind(this));
		this.worker.onMessage(this.worker.ops, 'log', this.onOpsWorkerLog.bind(this));
		this.worker.onMessage(this.worker.ops, 'terminate', this.terminate.bind(this));
		this.worker.onExchange('web_request', this.onWebRequestExchange.bind(this));

		// prebind some message handlers to `this` for reuse
		this.$onWebRequestHeaders   = this.onWebRequestHeaders.bind(this);
		this.$onWebRequestData      = this.onWebRequestData.bind(this);
		this.$onWebRequestEnd       = this.onWebRequestEnd.bind(this);
		this.$onWebResponseHeaders  = this.onWebResponseHeaders.bind(this);
		this.$onWebResponseData     = this.onWebResponseData.bind(this);
		this.$onWebResponseEnd      = this.onWebResponseEnd.bind(this);
		this.$onWebClose            = this.onWebClose.bind(this);
	}
	local.env.WorkerServer = WorkerServer;
	WorkerServer.prototype = Object.create(Server.prototype);

	// EXPORTED
	// possible states
	WorkerServer.BOOT   = 0; // initial, not ready to do work
	WorkerServer.READY  = 1; // local bootstrap is loaded, awaiting user script
	WorkerServer.ACTIVE = 2; // local bootstrap and user script loaded, server may handle requests
	WorkerServer.DEAD   = 3; // should be cleaned up


	// ops exchange handlers
	// -

	// runs Local initialization for a worker thread
	// - called when the bootstrap has finished loading
	WorkerServer.prototype.onOpsWorkerReady = function(message) {
		this.hasHostPrivileges = message.data.hostPrivileges;
		if (this.hasHostPrivileges) {
			// disable dangerous APIs
			this.worker.nullify('XMLHttpRequest');
			this.worker.nullify('Worker');
		}
		// hold onto the ready message and update state, so the environment can finish preparing us
		// (the config must be locked before we continue from here)
		this.state = WorkerServer.READY;
		if (this.canLoadUserscript)
			this.loadUserScript();
	};

	// logs message data from the worker
	WorkerServer.prototype.onOpsWorkerLog = function(message) {
		if (!message.data)
			return;
		if (!Array.isArray(message.data))
			return console.error('Received invalid ops-exchange "log" message: Payload must be an array', message);

		var type = message.data.shift();
		var args = ['['+this.config.domain+']'].concat(message.data);
		switch (type) {
			case 'error':
				console.error.apply(console, args);
				break;
			case 'warn':
				console.warn.apply(console, args);
				break;
			default:
				console.log.apply(console, args);
				break;
		}
	};

	// destroys the server
	// - called when the worker has died, or when the environment wants the server to die
	WorkerServer.prototype.terminate = function() {
		this.state = WorkerServer.DEAD;
		this.worker.terminate();
	};


	// user script-loading api
	// -

	WorkerServer.prototype.loadUserScript = function() {
		this.canLoadUserscript = true; // flag that the environment is ready for us
		if (this.state != WorkerServer.READY)
			return; // wait for the worker to be ready

		if (this.hasHostPrivileges) {
			// encode src in base64 if needed
			var src = this.config.src;
			if (src.indexOf('data:application/javascript,') === 0)
				src = 'data:application/javacsript;base64,'+btoa(src.slice(28));
			this.worker.sendMessage(this.worker.ops, 'configure', this.config);
			this.worker.importScripts(src, this.onWorkerUserScriptLoaded.bind(this));
		} else {
			this.onWorkerUserScriptLoaded();
		}
	};

	// starts normal operation
	// - called when the user script has finished loading
	WorkerServer.prototype.onWorkerUserScriptLoaded = function(message) {
		if (this.loadCb && typeof this.loadCb == 'function')
			this.loadCb(message);
		if (message && message.data.error) {
			console.error('Failed to load user script in worker, terminating', message, this);
			this.terminate();
		}
		else if (this.state != WorkerServer.DEAD) {
			this.state = WorkerServer.ACTIVE;
			this.worker.resumeExchangeTopic('web_request');
			this.worker.resumeExchangeTopic('web_subscribe');
		}
	};


	// server behavior api
	// -

	// dispatches the request to the worker for handling
	// - called when a request is issued to the worker-server
	// - mirrors setRequestDispatcher(function) in worker/http.js
	WorkerServer.prototype.handleHttpRequest = function(request, response) {
		var worker = this.worker;

		// setup exchange and exchange handlers
		var exchange = worker.startExchange('web_request');
		worker.setExchangeMeta(exchange, 'request', request);
		worker.setExchangeMeta(exchange, 'response', response);
		worker.onMessage(exchange, 'response_headers', this.$onWebResponseHeaders);
		worker.onMessage(exchange, 'response_data', this.$onWebResponseData);
		worker.onMessage(exchange, 'response_end', this.$onWebResponseEnd);
		worker.onMessage(exchange, 'close', this.$onWebClose);

		// wire request into the exchange
		worker.sendMessage(exchange, 'request_headers', request);
		request.on('data', function(data) { worker.sendMessage(exchange, 'request_data', data); });
		request.on('end', function() { worker.sendMessage(exchange, 'request_end'); });
	};

	// retrieve server source
	// - `requester` is the object making the request
	WorkerServer.prototype.getSource = function(requester) {
		if (/^data/.test(this.config.src)) {
			var firstCommaIndex = this.config.src.indexOf(',');
			if (this.config.src.indexOf('data:application/javascript;base64,') === 0)
				return local.promise(atob(this.config.src.slice(firstCommaIndex+1) || ''));
			else
				return local.promise(this.config.src.slice(firstCommaIndex+1) || '');
		}

		// request from host
		var jsRequest = { method:'get', url:this.config.src, headers:{ accept:'application/javascript' }};
		return local.web.dispatch(jsRequest, requester).then(
			function(res) { return res.body; },
			function(res) {
				console.log('failed to retrieve worker source:', res);
				return '';
			}
		);
	};


	// web request exchange handlers
	// -

	// dispatches a request to local.http and sends the response back to the worker
	// - called when the worker-server issues a request
	// - mirrors app.onExchange('web_request') in worker/http.js
	WorkerServer.prototype.onWebRequestExchange = function(exchange) {
		this.worker.onMessage(exchange, 'request_headers', this.$onWebRequestHeaders);
		this.worker.onMessage(exchange, 'request_data', this.$onWebRequestData);
		this.worker.onMessage(exchange, 'request_end', this.$onWebRequestEnd);
		this.worker.onMessage(exchange, 'close', this.$onWebClose);
	};

	WorkerServer.prototype.onWebRequestHeaders = function(message) {
		if (!message.data) {
			console.error('Invalid "request_headers" message from worker: Payload missing', message);
			this.worker.endExchange(message.exchange);
			return;
		}

		// create request
		var request = new local.web.Request(message.data);
		this.worker.setExchangeMeta(message.exchange, 'request', request);

		// dispatch request
		var worker = this.worker;
		request.stream = true; // we always want streaming so we can wire up to the data & end events
		local.web.dispatch(request, this).always(function(response) {
			worker.setExchangeMeta(message.exchange, 'response', response);

			// wire response into the exchange
			worker.sendMessage(message.exchange, 'response_headers', response);
			response.on('data', function(data) { worker.sendMessage(message.exchange, 'response_data', data); });
			response.on('end', function() { worker.sendMessage(message.exchange, 'response_end'); });
			response.on('close', function() { worker.endExchange(message.exchange); });
		});
	};

	WorkerServer.prototype.onWebRequestData = function(message) {
		if (typeof message.data != 'string') {
			console.error('Invalid "request_data" message from worker: Payload must be a string', message);
			this.worker.endExchange(message.exchange);
			return;
		}

		var request = this.worker.getExchangeMeta(message.exchange, 'request');
		if (!request) {
			console.error('Invalid "request_data" message from worker: Request headers not previously received', message);
			this.worker.endExchange(message.exchange);
			return;
		}

		request.write(message.data);
	};

	WorkerServer.prototype.onWebRequestEnd = function(message) {
		var request = this.worker.getExchangeMeta(message.exchange, 'request');
		if (!request) {
			console.error('Invalid "request_end" message from worker: Request headers not previously received', message);
			this.worker.endExchange(message.exchange);
			return;
		}

		request.end();
	};

	WorkerServer.prototype.onWebResponseHeaders = function(message) {
		if (!message.data) {
			console.error('Invalid "response_headers" message from worker: Payload missing', message);
			this.worker.endExchange(message.exchange);
			return;
		}

		var response = this.worker.getExchangeMeta(message.exchange, 'response');
		if (!response) {
			console.error('Internal error when receiving "response_headers" message from worker: Response object not present', message);
			this.worker.endExchange(message.exchange);
			return;
		}

		response.writeHead(message.data.status, message.data.reason, message.data.headers);
	};

	WorkerServer.prototype.onWebResponseData = function(message) {
		if (typeof message.data != 'string') {
			console.error('Invalid "response_data" message from worker: Payload must be a string', message);
			this.worker.endExchange(message.exchange);
			return;
		}

		var response = this.worker.getExchangeMeta(message.exchange, 'response');
		if (!response) {
			console.error('Internal error when receiving "response_data" message from worker: Response object not present', message);
			this.worker.endExchange(message.exchange);
			return;
		}

		response.write(message.data);
	};

	WorkerServer.prototype.onWebResponseEnd = function(message) {
		var response = this.worker.getExchangeMeta(message.exchange, 'response');
		if (!response) {
			console.error('Internal error when receiving "response_end" message from worker: Response object not present', message);
			this.worker.endExchange(message.exchange);
			return;
		}

		response.end();
	};

	// closes the request/response, caused by a close of the exchange
	// - could happen because the response has ended
	// - could also happen because the request aborted
	// - could also happen due to a bad message
	WorkerServer.prototype.onWebClose = function(message) {
		var request = this.worker.getExchangeMeta(message.exchange, 'request');
		var response = this.worker.getExchangeMeta(message.exchange, 'response');
		if (request) request.close();
		if (response) response.close();
	};
})();// WebRTC Peer Server
// ==================

(function() {

  var peerConstraints = {
    optional: [{ RtpDataChannels: true }]
  };
  var mediaConstraints = {
    optional: [],
    mandatory: { OfferToReceiveAudio: false, OfferToReceiveVideo: false }
  };
  var defaultIceServers = { iceServers: [{ url: 'stun:stun.l.google.com:19302' }] };

  // RTCPeerServer
  // =============
  // EXPORTED
  // server wrapper for WebRTC connections
  // - currently only supports Chrome
  // - `config.sigRelay`: a URI or navigator instance for a grimwire.com/rel/sse/relay
  // - `config.initiate`: should this peer send the offer? If false, will wait for one
  // - `chanOpenCb`: function, called when request channel is available
  function RTCPeerServer(config, chanOpenCb) {
    var self = this;
    if (!config) config = {};
    if (!config.sigRelay) throw "`config.sigRelay` is required";
    local.env.Server.call(this);

    // :DEBUG:
    this.debugname = config.initiate ? 'A' : 'B';

    // hook up to sse relay
    var signalHandler = onSigRelayMessage.bind(this);
    this.sigRelay = local.web.navigator(config.sigRelay);
    this.sigRelay.subscribe({ headers: { 'last-event-id': -1 } })
      .then(function(stream) {
        self.state.signaling = true;
        self.sigRelayStream = stream;
        stream.on('message', signalHandler);
      });
    this.sigRelayStream = null;

    // create peer connection
    var servers = defaultIceServers;
    if (config.iceServers)
      servers = config.iceServers.concat(servers); // :TODO: is concat what we want?
    this.peerConn = new webkitRTCPeerConnection(servers, peerConstraints);
    this.peerConn.onicecandidate = onIceCandidate.bind(this);

    // create request data channel
    this.reqChannel = this.peerConn.createDataChannel('requestChannel', { reliable: false });
    setupRequestChannel.call(this);
    this.chanOpenCb = chanOpenCb;

    // internal state
    this.__offerOnReady = !!config.initiate;
    this.__isOfferExchanged = false;
    this.__candidateQueue = []; // cant add candidates till we get the offer
    this.__ridcounter = 1; // current request id
    this.__incomingRequests = {}; // only includes requests currently being received
    this.__incomingResponses = {}; // only includes responses currently being received
    this.__reqChannelBuffer = {}; // used to buffer messages that arrive out of order

    // state flags (for external reflection)
    this.state = {
      alive: true,
      signaling: false,
      connected: false
    };

    this.signal({ type: 'ready' });
  }
  local.env.RTCPeerServer = RTCPeerServer;
  RTCPeerServer.prototype = Object.create(local.env.Server.prototype);

  // :DEBUG:
  RTCPeerServer.prototype.debugLog = function() {
    var args = [this.debugname].concat([].slice.call(arguments));
    console.debug.apply(console, args);
  };


  // server behaviors
  // -

  // request handler
  RTCPeerServer.prototype.handleHttpRequest = function(request, response) {
    this.debugLog('HANDLING REQUEST', request);
    
    if (request.path == '/') {
      // Self resource
      response.setHeader('link', [
        { href: '/', rel: 'self service via' },
        { href: '/{id}', rel: 'http://grimwire.com/rel/proxy' }
        // :TODO: any links shared by the peer
      ]);
      if (request.method == 'GET') response.writeHead(200, 'ok', { 'content-type': 'application/json' }).end(this.state);
      else if (request.method == 'HEAD') response.writeHead(200, 'ok').end();
      else response.writeHead(405, 'bad method').end();
    }
    else {
      // Proxy resource
      proxyRequestToPeer.call(this, request, response);
    }
  };

  // sends a received request to the peer to be dispatched
  function proxyRequestToPeer(request, response) {
    var self = this;
    var via = getViaDesc.call(this);
    var myHost = 'httpl://'+self.config.domain+'/';

    var targetUrl = decodeURIComponent(request.path.slice(1));
    var targetUrld = local.web.parseUri(targetUrl);
    var theirHost = targetUrld.authority ? (targetUrld.protocol + '://' + targetUrld.authority) : myHost;

    // gen subsequent request
    var req2 = new local.web.Request(request);
    req2.url = targetUrl;
    // add via
    req2.headers.via = (req2.headers.via) ? req2.headers.via.concat(via) : [via];

    // dispatch the request in the peer namespace
    req2.stream = true;
    this.peerDispatch(req2).always(function(res2) {

      // update response links to include the proxy
      if (res2.headers.link) {
        res2.headers.link.forEach(function(link) {
          var urld = local.web.parseUri(link.href);
          if (!urld.host)
            link.href = theirHost + link.href; // prepend their host if they gave relative links
          link.href = myHost + link.href; // now prepend our host
        });
      }
      // add via
      res2.headers.via = (res2.headers.via) ? res2.headers.via.concat(via) : [via];

      // pipe back
      response.writeHead(res2.status, res2.reason, res2.headers);
      res2.on('data', response.write.bind(response));
      res2.on('end', response.end.bind(response));
    });

    // pipe out
    request.on('data', req2.write.bind(req2));
    request.on('end', req2.end.bind(req2));
  }

  // helper, used to gen the via header during proxying
  function getViaDesc() {
    return {
      protocol: { name: 'httpl', version: '0.4' },
      host: this.config.domain,
      comment: 'Grimwire/0.2'
    };
  }

  RTCPeerServer.prototype.terminate = function() {
    closePeer.call(this);
  };


  // request channel behaviors
  // -

  // sends a request to the peer to dispatch in their namespace
  // - `request`: local.web.Request
  // - only behaves as if request.stream == true (no response buffering)
  RTCPeerServer.prototype.peerDispatch = function(request) {
    // generate ids
    var reqid = this.__ridcounter++;
    var resid = -reqid;

    // track the response
    var response_ = local.promise();
    var response = new local.web.Response();
    response.on('headers', function(response) {
      local.web.fulfillResponsePromise(response_, response);
    });
    this.__incomingResponses[resid] = response;

    if (this.state.connected) {
      var reqmid = 0; // message counter in the request stream
      var chan = this.reqChannelReliable;
      chan.send(reqid+':'+(reqmid++)+':h:'+JSON.stringify(request));
      // wire up the request to pipe over
      request.on('data', function(data) { chan.send(reqid+':'+(reqmid++)+':d:'+data); });
      request.on('end', function() { chan.send(reqid+':'+(reqmid++)+':e'); });
      request.on('close', function() { chan.send(reqid+':'+(reqmid++)+':c'); });
    } else {
      // not connected, send a 504
      setTimeout(function() { response.writeHead(504, 'gateway timeout').end(); }, 0);
      // ^ wait till next tick, as the dispatch is expected to be async
    }

    return response_;
  };

  // request channel incoming traffic handling
  // - message format: <rid>:<mid>:<message type>[:<message data>]
  //   - rid: request/response id, used to group together messages
  //   - mid: message id, used to guarantee arrival ordering
  //   - message type: indicates message content
  //   - message data: optional, the message content
  // - message types:
  //   - 'h': headers* (new request)
  //   - 'd': data* (request content, may be sent multiple times)
  //   - 'e': end (request finished)
  //   - 'c': close (request closed)
  //   - *includes a message body
  // - responses use the negated rid (request=5 -> response=-5)
  function handleReqChannelIncomingMessage(msg) {
    this.debugLog('REQ CHANNEL RELIABLE MSG', msg);

    var parsedmsg = parseReqChannelMessage(msg);
    if (!parsedmsg) return;

    ensureReqChannelOrder.call(this, parsedmsg, function() {
      if (parsedmsg[0] > 0)
        // received a request to be dispatched within our namespace
        handlePeerRequest.apply(this, parsedmsg);
      else
        // received a response to a previous request of ours
        handlePeerResponse.apply(this, parsedmsg);
    });
  }

  // handles incoming request messages from the peer
  function handlePeerRequest(reqid, mid, mtype, mdata) {
    var chan = this.reqChannelReliable;
    var request;
    if (mtype == 'h') {
      try { request = JSON.parse(mdata); }
      catch (e) { return console.warn('RTCPeerServer - Unparseable request headers message from peer', reqid, mtype, mdata); }

      // new request from the peer, redispatch it on their behalf
      request.stream = true;
      request = new local.web.Request(request);
      local.web.dispatch(request, this).always(function(response) {
        var resid = -reqid; // indicate response with negated request id
        var resmid = 0; // message counter in the response stream
        chan.send(resid+':'+(resmid++)+':h:'+JSON.stringify(response));
        // wire up the response to pipe back
        response.on('data', function(data) { chan.send(resid+':'+(resmid++)+':d:'+data); });
        response.on('end', function() { chan.send(resid+':'+(resmid++)+':e'); });
        response.on('close', function() { chan.send(resid+':'+(resmid++)+':c'); });
      });

      this.__incomingRequests[reqid] = request; // start tracking
    } else {
      request = this.__incomingRequests[reqid];
      if (!request) { return console.warn('RTCPeerServer - Invalid request id', reqid, mtype, mdata); }
      // pass on additional messages in the request stream as they come
      switch (mtype) {
        case 'd': request.write(mdata); break;
        case 'e': request.end(); break;
        case 'c':
          // request stream closed, shut it down
          request.close();
          delete this.__incomingRequests[reqid];
          delete this.__reqChannelBuffer[reqid];
          break;
        default: console.warn('RTCPeerServer - Unrecognized message from peer', reqid, mtype, mdata);
      }
    }
  }

  // handles response messages from a previous request made to the peer
  function handlePeerResponse(resid, mid, mtype, mdata) {
    var response = this.__incomingResponses[resid];
    if (!response)
      return console.warn('RTCPeerServer - Invalid response id', resid, mtype, mdata);
    // pass on messages in the response stream as they come
    switch (mtype) {
      case 'h':
        try { mdata = JSON.parse(mdata); }
        catch (e) { return console.warn('RTCPeerServer - Unparseable response headers message from peer', resid, mtype, mdata); }
        response.writeHead(mdata.status, mdata.reason, mdata.headers);
        break;
      case 'd': response.write(mdata); break;
      case 'e': response.end(); break;
      case 'c':
        // response stream closed, shut it down
        response.close();
        delete this.__incomingResponses[resid];
        delete this.__reqChannelBuffer[resid];
        break;
      default: console.warn('RTCPeerServer - Unrecognized message from peer', resid, mtype, mdata);
    }
  }

  // splits a request-channel message into its parts
  // - format: <rid>:<message type>[:<message>]
  var reqChannelMessageRE = /([\-\d]+):([\-\d]+):(.)(:.*)?/;
  function parseReqChannelMessage(msg) {
    var match = reqChannelMessageRE.exec(msg);
    if (!match) { console.warn('RTCPeerServer - Unparseable message from peer', msg); return null; }
    var parsedmsg = [parseInt(match[1], 10), parseInt(match[2], 10), match[3]];
    if (match[4])
      parsedmsg.push(match[4].slice(1));
    return parsedmsg;
  }

  // tracks messages received in the request channel and delays processing if received out of order
  function ensureReqChannelOrder(parsedmsg, cb) {
    var rid = parsedmsg[0];
    var mid = parsedmsg[1];

    var buffer = this.__reqChannelBuffer[rid];
    if (!buffer)
      buffer = this.__reqChannelBuffer[rid] = { nextmid: 0, cbs: {} };

    if (mid > buffer.nextmid) { // not the next message?
      buffer.cbs[mid] = cb; // hold onto that callback
      this.debugLog('REQ CHANNEL MSG OoO, BUFFERING', parsedmsg);
    } else {
      cb.call(this);
      buffer.nextmid++;
      while (buffer.cbs[buffer.nextmid]) { // burn through the queue
        this.debugLog('REQ CHANNEL DRAINING OoO MSG', buffer.nextmid);
        buffer.cbs[buffer.nextmid].call(this);
        delete buffer.cbs[buffer.nextmid];
        buffer.nextmid++;
      }
    }
  }

  function setupRequestChannel() {
    this.reqChannelReliable = new Reliable(this.reqChannel); // :DEBUG: remove when reliable: true is supported
    this.reqChannel.onopen = onReqChannelOpen.bind(this);
    this.reqChannel.onclose = onReqChannelClose.bind(this);
    this.reqChannel.onerror = onReqChannelError.bind(this);
    // this.reqChannel.onmessage = handleReqChannelMessage.bind(this);
    this.reqChannelReliable.onmessage = handleReqChannelIncomingMessage.bind(this);
  }

  function onReqChannelOpen(e) {
    this.debugLog('REQ CHANNEL OPEN', e);
    this.state.connected = true;
    if (typeof this.chanOpenCb == 'function')
      this.chanOpenCb();
  }

  function onReqChannelClose(e) {
    // :TODO: anything?
    this.debugLog('REQ CHANNEL CLOSE', e);
  }

  function onReqChannelError(e) {
    // :TODO: anything?
    this.debugLog('REQ CHANNEL ERR', e);
  }


  // signal relay behaviors
  // -

  // called when we receive a message from the relay
  function onSigRelayMessage(m) {
    var self = this;
    var from = m.event, data = m.data;

    if (data && typeof data != 'object') {
      console.warn('RTCPeerServer - Unparseable signal message from'+from, m);
      return;
    }

    // this.debugLog('SIG', m, from, data.type, data);
    switch (data.type) {
      case 'ready':
        // peer's ready to start
        if (this.__offerOnReady)
          sendOffer.call(this);
        break;

      case 'closed':
        // peer's dead, shut it down
        closePeer.call(this);
        break;

      case 'candidate':
        this.debugLog('GOT CANDIDATE', data.candidate);
        // received address info from the peer
        if (!this.__isOfferExchanged) this.__candidateQueue.push(data.candidate);
        else this.peerConn.addIceCandidate(new RTCIceCandidate({ candidate: data.candidate }));
        break;

      case 'offer':
        this.debugLog('GOT OFFER', data);
        // received a session offer from the peer
        this.peerConn.setRemoteDescription(new RTCSessionDescription(data));
        handleOfferExchanged.call(self);
        this.peerConn.createAnswer(
          function(desc) {
            self.debugLog('CREATED ANSWER', desc);
            desc.sdp = Reliable.higherBandwidthSDP(desc.sdp); // :DEBUG: remove when reliable: true is supported
            self.peerConn.setLocalDescription(desc);
            self.signal({
              type: 'answer',
              sdp: desc.sdp
            });
          },
          null,
          mediaConstraints
        );
        break;

      case 'answer':
        this.debugLog('GOT ANSWER', data);
        // received session confirmation from the peer
        this.peerConn.setRemoteDescription(new RTCSessionDescription(data));
        handleOfferExchanged.call(self);
        break;

      default:
        console.warn('RTCPeerServer - Unrecognized signal message from'+from, m);
    }
  }

  // helper to send a message to peers on the relay
  RTCPeerServer.prototype.signal = function(data) {
    this.sigRelay.dispatch({
      method: 'notify',
      headers: {
        authorization: this.sigRelay.authHeader,
        'content-type': 'application/json'
      },
      body: data
    }).then(null, function(res) {
      console.warn('RTCPeerServer - Failed to send signal message to relay', res);
    });
  };

  // helper initiates a session with peers on the relay
  function sendOffer() {
    var self = this;
    this.peerConn.createOffer(
      function(desc) {
        self.debugLog('CREATED OFFER', desc);
        desc.sdp = Reliable.higherBandwidthSDP(desc.sdp); // :DEBUG: remove when reliable: true is supported
        self.peerConn.setLocalDescription(desc);
        self.signal({
          type: 'offer',
          sdp: desc.sdp
        });
      },
      null,
      mediaConstraints
    );
  }

  // helper shuts down session
  function closePeer() {
    this.signal({ type: 'closed' });
    this.state.alive = false;
    this.state.signaling = false;
    this.state.connected = false;

    if (this.sigRelayStream)
      this.sigRelayStream.close();
    if (this.peerConn)
      this.peerConn.close();
  }

  // helper called whenever we have a remote session description
  // (candidates cant be added before then, so they're queued in case they come first)
  function handleOfferExchanged() {
    var self = this;
    this.__isOfferExchanged = true;
    this.__candidateQueue.forEach(function(candidate) {
      self.peerConn.addIceCandidate(new RTCIceCandidate({ candidate: candidate }));
    });
    this.__candidateQueue.length = 0;
  }

  // called by the RTCPeerConnection when we get a possible connection path
  function onIceCandidate(e) {
    if (e && e.candidate) {
      this.debugLog('FOUND ICE CANDIDATE', e.candidate);
      // send connection info to peers on the relay
      this.signal({
        type: 'candidate',
        candidate: e.candidate.candidate
      });
    }
  }
})();// Env Core
// ========

local.env.config = {
	workerBootstrapUrl : 'worker.min.js'
};

local.env.servers = {};
local.env.clientRegions = {};
local.env.numServers = 0;
local.env.numClientRegions = 0;

local.env.addServer = function(domain, server) {
	// instantiate the application
	server.config.domain = domain;
	local.env.servers[domain] = server;
	local.env.numServers++;

	// allow the user script to load
	if (server.loadUserScript)
		server.loadUserScript();

	// register the server
	local.web.registerLocal(domain, server.handleHttpRequest, server);

	return server;
};

local.env.killServer = function(domain) {
	var server = local.env.servers[domain];
	if (server) {
		local.web.unregisterLocal(domain);
		server.terminate();
		delete local.env.servers[domain];
		local.env.numServers--;
	}
};

local.env.getServer = function(domain) { return local.env.servers[domain]; };
local.env.listFilteredServers = function(fn) {
	var list = {};
	for (var k in local.env.servers) {
		if (fn(local.env.servers[k], k)) list[k] = local.env.servers[k];
	}
	return list;
};

local.env.addClientRegion = function(clientRegion) {
	var id;
	if (typeof clientRegion == 'object')
		id = clientRegion.id;
	else {
		id = clientRegion;
		clientRegion = new local.client.Region(id);
	}
	local.env.clientRegions[clientRegion.id] = clientRegion;
	local.env.numClientRegions++;
	return clientRegion;
};

local.env.removeClientRegion = function(id) {
	if (local.env.clientRegions[id]) {
		local.env.clientRegions[id].terminate();
		delete local.env.clientRegions[id];
		local.env.numClientRegions--;
	}
};

local.env.getClientRegion = function(id) { return local.env.clientRegions[id]; };

// dispatch wrapper
// - allows the deployment to control request permissions / sessions / etc
// - adds the `origin` parameter to dispatch(), which is the object responsible for the request
var envDispatchWrapper;
local.web.setDispatchWrapper(function(request, response, dispatch, origin) {
	// parse the url
	var urld = local.web.parseUri(request.url); // (urld = url description)

	// if the urld has query parameters, extract them into the request's query object
	if (urld.query) {
		var q = local.web.contentTypes.deserialize(urld.query, 'application/x-www-form-urlencoded');
		for (var k in q)
			request.query[k] = q[k];
		delete urld.query; // avoid doing this again later
		urld.relative = urld.path + ((urld.anchor) ? ('#'+urld.anchor) : '');
		request.url = urld.protocol+'://'+urld.authority+urld.relative;
	}

	request.urld = urld;
	envDispatchWrapper.call(null, request, response, dispatch, origin);
});
local.env.setDispatchWrapper = function(fn) {
	envDispatchWrapper = fn;
};
local.env.setDispatchWrapper(function(request, response, dispatch, origin) {
	return dispatch(request, response);
});

// response html post-process
// - override this to modify html after it has entered the document
// - useful for adding local.env widgets
var postProcessRegion = function() {};
local.env.postProcessRegion = function(elem, containerElem) { return postProcessRegion(elem, containerElem); };
local.env.setRegionPostProcessor = function(fn) {
	postProcessRegion = fn;
};})();