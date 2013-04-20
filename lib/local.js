// promises
// ========
// pfraze 2013

(function () {
	var exports = this;
	if (typeof window !== "undefined") {
		if (typeof window.Local == 'undefined')
			window.Local = {};
		exports = window.Local;
	} else if (typeof self !== "undefined") {
		if (typeof self.Local == 'undefined')
			self.Local = {};
		exports = self.Local;
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
				if (console.error) console.error("Promise exception thrown", e, '("'+e.toString()+'")');
				else console.log("Promise exception thrown", e, '("'+e.toString()+'")');
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
	function nodeStyleCB(p) {
		return function (err, value) {
			if (err) {
				return p.reject(err);
			} else {
				return p.fulfill((typeof value == 'undefined') ? null : value);
			}
		};
	}

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
	exports.nodeStyleCB = nodeStyleCB;
})();

if (typeof define !== "undefined") {
	define([], function() {
		return Promise;
	});
}// LinkJS
// ======
// pfraze 2012
function noop() {}
var Link = {};// Helpers
// =======
(function(exports) {

	// EventEmitter
	// ============
	// EXPORTED
	// A minimal event emitter, based on the NodeJS api
	// initial code borrowed from https://github.com/tmpvar/node-eventemitter (thanks tmpvar)
	function EventEmitter() {
		this._events = {};
	}

	EventEmitter.prototype.emit = function(type) {
		var handlers = this._events[type];
		if (!handlers) return false;

		var args = Array.prototype.slice.call(arguments, 1);
		for (var i = 0, l = handlers.length; i < l; i++) {
			handlers[i].apply(this, args);
		}
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
		return this;
	};

	EventEmitter.prototype.listeners = function(type) {
		return this._events[type];
	};

	exports.EventEmitter  = EventEmitter;

	// Headerer
	// ========
	// EXPORTED
	// a utility for building request and response headers
	// - may be passed to `response.writeHead()`
	function Headerer(init) {
		// copy out any initial values
		if (init && typeof init == 'object') {
			for (var k in init) {
				if (init.hasOwnProperty(k)) {
					this[k] = init[k];
				}
			}
		}
	}

	// adds an entry to the Link header
	// - `href` may be a relative path for the context's domain
	// - `rel` should be a value found in http://www.iana.org/assignments/link-relations/link-relations.xml
	// - `rel` may contain more than on value, separated by spaces
	// - `other` is an optional object of other KVs for the header
	Headerer.prototype.addLink = function(href, rel, other) {
		var entry = other || {};
		entry.href = href;
		entry.rel = rel;
		if (!this.link) {
			this.link = [];
		}
		this.link.push(entry);
		return this;
	};

	// sets the Authorization header
	// - `auth` must include a `scheme`, and any other vital parameters for the given scheme
	Headerer.prototype.setAuth = function(auth) {
		this.authorization = auth;
		return this;
	};

	// converts the headers into string forms for transfer over HTTP
	Headerer.prototype.serialize = function() {
		if (this.link && Array.isArray(this.link)) {
			// :TODO:
			throw "Link header serialization is not yet implemented";
		}
		if (this.authorization && typeof this.authorization == 'object') {
			if (!this.authorization.scheme) { throw "`scheme` required for auth headers"; }
			var auth;
			switch (this.authorization.scheme.toLowerCase()) {
				case 'basic':
					auth = 'Basic '+btoa(this.authorization.name+':'+this.authorization.password);
					break;
				case 'persona':
					auth = 'Persona name='+this.authorization.name+' assertion='+this.authorization.assertion;
					break;
				default:
					throw "unknown auth sceme: "+this.authorization.scheme;
			}
			this.authorization = auth;
		}
		return this;
	};

	// wrap helper
	function headerer(h) {
		return (h instanceof Headerer) ? h : new Headerer(h);
	}

	exports.Headerer     = Headerer;
	exports.headerer     = headerer;

	// Link.parseLinkHeader
	// EXPORTED
	// breaks a link header into a javascript object
	exports.parseLinkHeader = function(headerStr) {
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
	exports.lookupLink = function(links, rel, title) {
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
	exports.joinUrl = function() {
		var parts = Array.prototype.map.call(arguments, function(arg) {
			var lo = 0, hi = arg.length;
			if (arg.charAt(0) === '/')      { lo += 1; }
			if (arg.charAt(hi - 1) === '/') { hi -= 1; }
			return arg.substring(lo, hi);
		});
		return parts.join('/');
	};

	// EXPORTED
	// parseUri 1.2.2, (c) Steven Levithan <stevenlevithan.com>, MIT License
	exports.parseUri = function(str) {
		if (typeof str === 'object') {
			if (str.url) { str = str.url; }
			else if (str.host || str.path) { str = Link.joinUrl(req.host, req.path); }
		}
		var	o   = exports.parseUri.options,
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

	exports.parseUri.options = {
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

	// contentTypes
	// ============
	// EXPORTED
	// provides serializers and deserializers for MIME types
	var contentTypes = {
		serialize   : contentTypes__serialize,
		deserialize : contentTypes__deserialize,
		register    : contentTypes__register
	};
	var contentTypes__registry = {};

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
			if (types[i] in contentTypes__registry) {
				return contentTypes__registry[types[i]][fn];
			}
		}
		return null;
	}

	// default types
	contentTypes__register('application/json',
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
	contentTypes__register('application/x-www-form-urlencoded',
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

	exports.contentTypes = contentTypes;
})(Link);// Core
// ====
// :NOTE: currently, Firefox is not able to retrieve response headers over CORS
(function(exports) {
	// stores local server functions
	var httpl_registry = {};
	// request dispatcher func
	// - used in workers to transport requests to the parent for routing
	var customRequestDispatcher = null;
	// the directory of the environment context
	var windowLocationDirname = (typeof window != 'undefined') ? window.location.pathname.split('/') : [''];
	windowLocationDirname[windowLocationDirname.length - 1] = '';
	windowLocationDirname = windowLocationDirname.join('/');

	// custom error type, for use in promises
	// EXPORTED
	function ResponseError(response) {
		response = response || {};
		response.headers = response.readers || {};

		this.message = ''+response.status+': '+response.reason;
		this.response = response;
	}
	ResponseError.prototype = new Error();

	// dispatch()
	// =========
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
	function dispatch(req) {
		// sanity check
		if (!req) { throw "no req param provided to request"; }

		// sane defaults
		req.headers = req.headers || {};
		req.query = req.query || {};

		// dispatch behavior override
		// (used by workers to send requests to the parent document for routing)
		if (customRequestDispatcher) {
			return customRequestDispatcher(req);
		}

		// parse the url
		// (urld = url description)
		if (req.url) {
			req.urld = Link.parseUri(req.url);
		} else {
			req.urld = Link.parseUri(Link.joinUrl(req.host, req.path));
		}
		if (!req.urld) {
			throw "no URL or host/path provided in request";
		}

		// prepend host on relative path
		if (!req.urld.protocol) {
			if (req.url.length > 0 && req.url.charAt(0) != '/') {
				// relative to current dirname
				req.url = window.location.protocol + "//" + window.location.host + windowLocationDirname + req.url;
			} else {
				// relative to current hose
				req.url = window.location.protocol + "//" + window.location.host + req.url;
			}
			req.urld = Link.parseUri(req.url);
		}

		// execute according to protocol (asyncronously)
		var resPromise = Local.promise();
		if (req.urld.protocol == 'httpl') {
			setTimeout(function() { __dispatchLocal(req, resPromise); }, 0);
		} else if (req.urld.protocol == 'http' || req.urld.protocol == 'https') {
			setTimeout(function() { __dispatchRemote(req, resPromise); }, 0);
		} else {
			resPromise.fulfill(new ResponseError({ status:0, reason:'unsupported protocol "'+req.urld.protocol+'"' }));
		}
		return resPromise;
	}

	// executes a request locally
	function __dispatchLocal(req, resPromise) {

		// find the local server
		var server = httpl_registry[req.urld.host];
		if (!server) {
			var res = new ClientResponse(404, 'server not found');
			resPromise.reject(new ResponseError(res));
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
			var q = Link.contentTypes.deserialize(req.urld.query, 'application/x-www-form-urlencoded');
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
			var q = Link.contentTypes.serialize(req.query, 'application/x-www-form-urlencoded');
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

		if (typeof window != 'undefined') {
			__dispatchRemoteBrowser(req, resPromise);
		} else {
			__dispatchRemoteNodejs(req, resPromise);
		}
	}

	// executes a remote request in the browser
	function __dispatchRemoteBrowser(req, resPromise) {

		// assemble the final url
		var url = ((req.urld.protocol) ? (req.urld.protocol + '://') : '') + req.urld.authority + req.urld.relative;

		// make sure our payload is serialized
		req.headers = Link.headerer(req.headers).serialize();
		if (req.body !== null && typeof req.body != 'undefined') {
			req.headers['content-type'] = req.headers['content-type'] || 'application/json';
			if (typeof req.body !== 'string') {
				req.body = Link.contentTypes.serialize(req.body, req.headers['content-type']);
			}
		}

		// create the request
		var xhrRequest = new XMLHttpRequest();
		xhrRequest.open(req.method, url, true);

		for (var k in req.headers) {
			if (req.headers[k] !== null && req.headers.hasOwnProperty(k)) {
				xhrRequest.setRequestHeader(k, req.headers[k]);
			}
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
				if (clientResponse.headers.link) {
					clientResponse.headers.link = Link.parseLinkHeader(clientResponse.headers.link);
				}

				if (req.stream) {
					// fulfill ahead of final response
					if (clientResponse.status >= 200 && clientResponse.status < 400) {
						resPromise.fulfill(clientResponse);
					} else if (clientResponse.status >= 400 && clientResponse.status < 600) {
						resPromise.reject(new ResponseError(clientResponse));
					} else if (clientResponse.status === 0) {
						resPromise.reject(new ResponseError({ code:0, reason:'Remote connection refused by the host' }));
					} else {
						// :TODO: protocol handling
						resPromise.reject(new ResponseError(clientResponse));
					}

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
				if (streamPoller) {
					clearInterval(streamPoller);
				}

				// finished streaming, try to deserialize the body
				var body = Link.contentTypes.deserialize(xhrRequest.responseText, clientResponse.headers['content-type']);

				if (!req.stream) {
					// set the body that we have now so its available on fulfill (aconvenience for nonstreamers)
					clientResponse.body = Link.contentTypes.deserialize(xhrRequest.responseText, clientResponse.headers['content-type']);

					// fulfill after final response
					if (clientResponse.status >= 200 && clientResponse.status < 400) {
						resPromise.fulfill(clientResponse);
					} else if (clientResponse.status >= 400 && clientResponse.status < 600) {
						resPromise.reject(new ResponseError(clientResponse));
					} else if (clientResponse.status === 0) {
						resPromise.reject(new ResponseError({ code:0, reason:'Remote connection refused by the host' }));
					} else {
						// :TODO: protocol handling
						resPromise.reject(new ResponseError(clientResponse));
					}
				} else {
					clientResponse.write(body);
				}
				clientResponse.end();
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
	function setRequestDispatcher(fn) {
		customRequestDispatcher = fn;
	}

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
		Link.EventEmitter.call(this);

		this.status = status;
		this.reason = reason;
		this.headers = {};
		this.body = null;
		this.isConnOpen = true;
	}
	ClientResponse.prototype = Object.create(Link.EventEmitter.prototype);
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
			this.body = Link.contentTypes.deserialize(this.body, this.headers['content-type']);
	};

	// ServerResponse
	// ==============
	// EXPORTED
	// Interface for responding to requests
	// - generated internally and given to document-local servers
	// - not given to clients; instead, will run client's callbacks as appropriate
	function ServerResponse(resPromise, isStreaming) {
		Link.EventEmitter.call(this);

		this.resPromise  = resPromise;
		this.isStreaming = isStreaming;
		this.clientResponse = new ClientResponse();
	}
	ServerResponse.prototype = Object.create(Link.EventEmitter.prototype);

	// writes the header to the response
	// if streaming, will notify the client
	ServerResponse.prototype.writeHead = function(status, reason, headers) {
		// setup client response
		this.clientResponse.status = status;
		this.clientResponse.reason = reason;
		for (var k in headers) {
			if (headers.hasOwnProperty(k)) {
				this.setHeader(k, headers[k]);
			}
		}

		// fulfill/reject
		if (this.isStreaming) { this.__fulfillPromise(); }
	};

	// header access/mutation fns
	ServerResponse.prototype.setHeader    = function(k, v) { this.clientResponse.headers[k] = v; };
	ServerResponse.prototype.getHeader    = function(k) { return this.clientResponse.headers[k]; };
	ServerResponse.prototype.removeHeader = function(k) { delete this.clientResponse.headers[k]; };

	// writes data to the response
	// if streaming, will notify the client
	ServerResponse.prototype.write = function(data) {
		this.clientResponse.write(data, false);
	};

	// ends the response, optionally writing any final data
	ServerResponse.prototype.end = function(data) {
		// write any remaining data
		if (data) { this.write(data); }

		// fulfill/reject now if we had been buffering the response
		if (!this.isStreaming) {
			this.clientResponse.__deserialize(); // go ahead and deserialize
			this.__fulfillPromise();
		}

		this.clientResponse.end();
		this.emit('close');

		// unbind all listeners
		this.removeAllListeners('close');
		this.clientResponse.removeAllListeners('data');
		this.clientResponse.removeAllListeners('end');
	};

	// fills the response promise with our clientResponse interface
	ServerResponse.prototype.__fulfillPromise = function() {
		if (this.clientResponse.status >= 200 && this.clientResponse.status < 400) {
			this.resPromise.fulfill(this.clientResponse);
		} else if (this.clientResponse.status >= 400 && this.clientResponse.status < 600) {
			this.resPromise.reject(new ResponseError(this.clientResponse));
		} else {
			// :TODO: protocol handling
			this.resPromise.reject(new ResponseError(this.clientResponse));
		}
	};

	// functions added just to compat with nodejs
	ServerResponse.prototype.writeContinue = noop;
	ServerResponse.prototype.addTrailers   = noop;
	ServerResponse.prototype.sendDate      = noop; // :TODO: is this useful?

	// registerLocal()
	// ===============
	// EXPORTED
	// adds a server to the httpl registry
	function registerLocal(domain, server, serverContext) {
		var urld = Link.parseUri(domain);
		if (urld.protocol && urld.protocol !== 'httpl') {
			throw "registerLocal can only add servers to the httpl protocol";
		}
		if (!urld.host) {
			throw "invalid domain provided to registerLocal";
		}
		if (httpl_registry[urld.host]) {
			throw "server already registered at domain given to registerLocal";
		}
		httpl_registry[urld.host] = { fn:server, context:serverContext };
	}

	// unregisterLocal()
	// =================
	// EXPORTED
	// removes a server from the httpl registry
	function unregisterLocal(domain) {
		var urld = Link.parseUri(domain);
		if (!urld.host) {
			throw "invalid domain provided toun registerLocal";
		}
		if (httpl_registry[urld.host]) {
			delete httpl_registry[urld.host];
		}
	}

	// getLocal()
	// ==========
	// EXPORTED
	// retrieves a server from the httpl registry
	function getLocal(domain) {
		var urld = Link.parseUri(domain);
		if (!urld.host) {
			throw "invalid domain provided toun registerLocal";
		}
		return httpl_registry[urld.host];
	}

	// getLocal()
	// ==========
	// EXPORTED
	// retrieves the httpl registry
	function getLocalRegistry() {
		return httpl_registry;
	}

	exports.ResponseError        = ResponseError;
	exports.dispatch             = dispatch;
	exports.registerLocal        = registerLocal;
	exports.unregisterLocal      = unregisterLocal;
	exports.getLocal             = getLocal;
	exports.getLocalRegistry     = getLocalRegistry;
	exports.setRequestDispatcher = setRequestDispatcher;
	exports.ClientResponse       = ClientResponse;
	exports.ServerResponse       = ServerResponse;
})(Link);// Events
// ======
// :NOTE: currently, Chrome does not support event streams with CORS
(function(exports) {
	// event subscriber func
	// - used in workers to transport subscribes to the parent for routing
	var customEventSubscriber = null;

	// subscribe()
	// =========
	// EXPORTED
	// Establishes a connection and begins an event stream
	// - sends a GET request with 'text/event-stream' as the Accept header
	// - `req` param:
	//   - requires the target url
	//   - target url can be passed in req as `url`, or generated from `host` and `path`
	// - returns a `EventStream` object
	function subscribe(req) {

		if (!req) { throw "no options provided to subscribe"; }
		if (typeof req == 'string') {
			req = { url:req };
		}

		// subscribe behavior override
		// (used by workers to send subscribes to the parent document for routing)
		if (customEventSubscriber) {
			return customEventSubscriber(req);
		}

		// parse the url
		if (req.url) {
			req.urld = Link.parseUri(req.url);
		} else {
			req.urld = Link.parseUri(Link.joinUrl(req.host, req.path));
		}
		if (!req.urld) {
			throw "no URL or host/path provided to subscribe";
		}

		// prepend host on relative path
		if (!req.urld.protocol) {
			req.url = window.location.protocol + "//" + window.location.host + req.url;
			req.urld = Link.parseUri(req.url);
		}

		// execute according to protocol
		if (req.urld.protocol == 'httpl') {
			return __subscribeLocal(req);
		} else {
			return __subscribeRemote(req);
		}
	}

	// subscribes to a local host
	function __subscribeLocal(req) {

		// initiate the event stream
		var stream = new LocalEventStream(Link.dispatch({
			method  : 'get',
			url     : 'httpl://' + req.urld.authority + req.urld.relative,
			headers : { accept : 'text/event-stream' },
			stream  : true
		}));
		return stream;
	}

	// subscribes to a remote host
	function __subscribeRemote(req) {
		if (typeof window != 'undefined') {
			return __subscribeRemoteBrowser(req);
		} else {
			return __subscribeRemoteNodejs(req);
		}
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
	function setEventSubscriber(fn) {
		customEventSubscriber = fn;
	}

	// EventStream
	// ===========
	// EXPORTED
	// provided by subscribe() to manage the events
	function EventStream() {
		Link.EventEmitter.call(this);
		this.isConnOpen = true;
	}
	EventStream.prototype = Object.create(Link.EventEmitter.prototype);
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
			function(err) {
				self.__emitError({ event:'error', data:err });
				self.close();
			}
		);
	}
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
			if (e.target.readyState == EventSource.CLOSED) {
				self.close();
			}
		};
	}
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
		Link.EventEmitter.prototype.addListener.call(this, type, listener);
	};
	BrowserRemoteEventStream.prototype.on = BrowserRemoteEventStream.prototype.addListener;
	BrowserRemoteEventStream.prototype.close = function() {
		this.eventSource.close();
		this.eventSource.onerror = null;
		this.eventSource = null;
		EventStream.prototype.close.call(this);
	};

	exports.subscribe          = subscribe;
	exports.setEventSubscriber = setEventSubscriber;
	exports.EventStream        = EventStream;
})(Link);// Navigator
// =========
(function(exports) {
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
			var urld  = Link.parseUri(this.url);
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
		var urld          = Link.parseUri(this.url);
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
			if (!parentNavigator) {
				throw "parentNavigator is required for navigators with relative contexts";
			}
		}
	}

	// executes an HTTP request to our context
	//  - uses additional parameters on the request options:
	//    - retry: bool, should the url resolve be tried if it previously failed?
	//    - noresolve: bool, should we use the url we have and not try to resolve one from our parent's links?
	Navigator.prototype.dispatch = function Navigator__dispatch(req) {
		if (!req || !req.method) { throw "request options not provided"; }
		var self = this;

		var response = Local.promise();
		((req.noresolve) ? Local.promise(this.context.getUrl()) : this.resolve({ retry:req.retry }))
			.succeed(function(url) {
				req.url = url;
				Link.dispatch(req)
					.succeed(function(res) {
						self.context.error = null;
						self.context.resolveState = NavigatorContext.RESOLVED;
						if (res.headers.link)
							self.links = res.headers.link;
						else
							self.links = self.links || []; // cache an empty link list so we dont keep trying during resolution
						return res;
					})
					.fail(function(err) {
						if (err.response.status === 404) {
							self.context.error = err;
							self.context.resolveState = NavigatorContext.FAILED;
						}
						throw err;
					})
					.chain(response);
			})
			.fail(function(err) {
				response.reject(err);
			});
		return response;
	};

	// executes a GET text/event-stream request to our context
	Navigator.prototype.subscribe = function Navigator__dispatch() {
		return this.resolve()
			.succeed(function(url) {
				return Link.subscribe(url);
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
	//  - returns a promise
	Navigator.prototype.resolve = function Navigator__resolve(options) {
		var self = this;
		var p = Local.promise();
		if (this.links !== null && (this.context.isResolved() || (this.context.isAbsolute() && this.context.isBad() === false)))
			p.fulfill(this.context.getUrl());
		else if (this.context.isBad() === false || (this.context.isBad() && options.retry)) {
			this.context.resetResolvedState();
			if (this.parentNavigator) {
				this.parentNavigator.__resolveChild(this, options)
					.then(function(url) {
						var p2 = Local.promise();
						// confirm that our url is correct with a head request
						self.head(null, null, null, { noresolve:true }).then(
							function(res) { p2.fulfill(url); }, // is correct, pass it on
							function(err) { p2.reject(err); }
						);
						return p2;
					})
					.chain(p);
			} else
				this.head(null, null, null, { noresolve:true })
					.then(function(res) { return self.context.getUrl(); })
					.chain(p);
		} else
			p.reject(this.context.getError());
		return p;
	};

	// resolves a child navigator's context relative to our own
	//  - may trigger resolution of parent contexts
	//  - options is optional and may include:
	//    - retry: bool, should the resolve be tried if it previously failed?
	//  - returns a promise
	Navigator.prototype.__resolveChild = function Navigator__resolveChild(childNav, options) {
		var self = this;
		var resolvedPromise = Local.promise();

		// resolve self before resolving child
		this.resolve(options).then(
			function() {
				var childUrl = self.__lookupLink(childNav.context);
				if (childUrl) {
					childNav.context.resolve(childUrl);
					resolvedPromise.fulfill(childUrl);
				} else {
					resolvedPromise.reject(new Link.ResponseError({ status:404, reason:'link relation not found' }));
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
		var href = Link.lookupLink(this.links, context.rel, context.relparams.title);

		if (href) {
			var url = Link.UriTemplate.parse(href).expand(context.relparams);
			var urld = Link.parseUri(url);
			if (!urld.host) { // handle relative URLs
				url = this.context.getHost() + urld.relative;
			}
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

	// wrap helper
	function navigator(url) {
		return (url instanceof Navigator) ? url : new Navigator(url);
	}

	// exports
	exports.navigator = navigator;
	exports.Navigator = Navigator;
})(Link);// UriTemplate
// ===========
// https://github.com/fxa/uritemplate-js
// Copyright 2012 Franz Antesberger, MIT License
(function (exports){
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

	exports.UriTemplate = UriTemplate;
})(Link);// set up for node or AMD
if (typeof module !== "undefined") {
	module.exports = Link;
}
else if (typeof define !== "undefined") {
	define([], function() {
		return Link;
	});
}// Broadcaster
// ===========
// extends linkjs
// pfraze 2012

(function (exports) {
	
	// Broadcaster
	// ===========
	// a wrapper for event-streams
	function Broadcaster() {
		this.streams = [];
	}

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
	function broadcaster() {
		return new Broadcaster();
	}

	exports.Broadcaster = Broadcaster;
	exports.broadcaster = broadcaster;
})(Link);// Responder
// =========
// extends linkjs
// pfraze 2012

(function (exports) {
	// responder sugar functions
	// =========================
	// this structure is used to build the various forms of the respond function
	// thanks to http://httpstatus.es/ for these descriptions
	var RESPONDER_FNS = {
		// information
		processing           : [102, 'server has received and is processing the request'],

		// success
		ok                   : [200, 'ok'],
		created              : [201, 'request has been fulfilled; new resource created'],
		accepted             : [202, 'request accepted, processing pending'],
		shouldBeOk           : [203, 'request processed, information may be from another source'],
		nonauthInfo          : [203, 'request processed, information may be from another source'],
		noContent            : [204, 'request processed, no content returned'],
		resetContent         : [205, 'request processed, no content returned, reset document view'],
		partialContent       : [206, 'partial resource return due to request header'],

		// redirection
		multipleChoices      : [300, 'multiple options for the resource delivered'],
		movedPermanently     : [301, 'this and all future requests directed to the given URI'],
		found                : [302, 'response to request found via alternative URI'],
		seeOther             : [303, 'response to request found via alternative URI'],
		notModified          : [304, 'resource has not been modified since last requested'],
		useProxy             : [305, 'content located elsewhere, retrieve from there'],
		switchProxy          : [306, 'subsequent requests should use the specified proxy'],
		temporaryRedirect    : [307, 'connect again to different uri as provided'],

		// client error
		badRequest           : [400, 'request cannot be fulfilled due to bad syntax'],
		unauthorized         : [401, 'authentication is possible but has failed'],
		forbidden            : [403, 'server refuses to respond to request'],
		notFound             : [404, 'requested resource could not be found'],
		methodNotAllowed     : [405, 'request method not supported by that resource'],
		notAcceptable        : [406, 'content not acceptable according to the Accept headers'],
		conflict             : [409, 'request could not be processed because of conflict'],
		gone                 : [410, 'resource is no longer available and will not be available again'],
		preconditionFailed   : [412, 'server does not meet request preconditions'],
		unsupportedMediaType : [415, 'server does not support media type'],
		teapot               : [418, 'I\'m a teapot'],
		enhanceYourCalm      : [420, 'rate limit exceeded'],
		unprocessableEntity  : [422, 'request unable to be followed due to semantic errors'],
		locked               : [423, 'resource that is being accessed is locked'],
		failedDependency     : [424, 'request failed due to failure of a previous request'],
		internalServerError  : [500, 'internal server error'],

		// server error
		serverError          : [500, 'internal server error'],
		notImplemented       : [501, 'server does not recognise method or lacks ability to fulfill'],
		badGateway           : [502, 'server received an invalid response from upstream server'],
		serviceUnavailable   : [503, 'server is currently unavailable'],
		unavailable          : [503, 'server is currently unavailable'],
		gatewayTimeout       : [504, 'gateway did not receive response from upstream server'],
		insufficientStorage  : [507, 'server is unable to store the representation'],
		notExtended          : [510, 'further extensions to the request are required']
	};

	var typeAliases = {
		'text'   : 'text/plain',
		'plain'  : 'text/plain',
		'json'   : 'application/json',
		'html'   : 'text/html',
		'xml'    : 'text/xml',
		'events-stream' : 'text/event-stream'
	};

	// Responder
	// =========
	// a protocol-helper for servers to easily fulfill requests
	// - `response` should be a `ServerResponse` object (given as the `response` param of the server's request handler fn)
	function Responder(response) {
		this.response = response;
	}

	// constructs and sends a response
	// - `status` may be a status integer or an array of `[status integer, reason string]`
	// - `type` may use an alias (such as 'html' for 'text/html' and 'json' for 'application/json')
	Responder.prototype.respond = function(status, type, headers) {
		var reason;
		if (Array.isArray(status)) {
			reason = status[1];
			status = status[0];
		}
		headers = headers || {};
		if (type)
			headers['content-type'] = (typeAliases[type] || type);
		this.response.writeHead(status, reason, headers);
		return this.response;
	};

	// add responder sugars
	for (var fnName in RESPONDER_FNS) {
		(function (status) {
			Responder.prototype[fnName] = function(type, headers) {
				return this.respond(status, type, headers);
			};
		})(RESPONDER_FNS[fnName]);
	}

	// sends the given response back verbatim
	// - if `writeHead` has been previously called, it will not change
	Responder.prototype.pipe = function(response, headersCB, bodyCb) {
		headersCB = headersCB || function(v) { return v; };
		bodyCb = bodyCb || function(v) { return v; };
		var self = this;
		var promise = Local.promise(response);
		promise
			.succeed(function(response) {
				if (!self.response.status) {
					// copy the header if we don't have one yet
					self.response.writeHead(response.status, response.reason, headersCB(response.headers));
				}
				if (response.body !== null && typeof response.body != 'undefined') { // already have the body?
					self.response.write(bodyCb(response.body));
				}
				if (response.on) {
					// wire up the stream
					response.on('data', function(data) {
						self.response.write(bodyCb(data));
					});
					response.on('end', function() {
						self.response.end();
					});
				} else {
					self.response.end();
				}
				return response;
			})
			.fail(function(err) {
				console.log('response piping error from upstream:', err);
				var ctype = err.response.headers['content-type'] || 'text/plain';
				var body = (ctype && err.response.body) ? err.response.body : '';
				self.badGateway(ctype).end(body);
				throw err;
			});
		return promise;
	};

	// creates a callback for a fixed response, used in promises
	Responder.prototype.cb = function(fnName, type, headers, body) {
		var fn = this[fnName]; var self = this;
		return function(v) {
			fn.call(self, type, headers).end(body);
			return v;
		};
	};

	// adds a type alias for use in the responder functions
	// - eg html -> text/html
	Responder.setTypeAlias = function(alias, mimetype) {
		typeAliases[alias] = mimetype;
	};

	// wrap helper
	function responder(res) {
		return (res instanceof Responder) ? res : new Responder(res);
	}

	exports.Responder = Responder;
	exports.responder = responder;
})(Link);// Router
// ======
// extends linkjs
// pfraze 2012

(function (exports) {
	// router sugar functions
	// ======================
	// this structure is used to build the various forms of the route function
	// - creates all possible combinations while maintaining order
	var ROUTER_FNS = ['p','pm','pma','pmat', 'pmta', 'pmt','pa','pt','m','ma','mat', 'mta', 'mt', 'mp', 'mpa', 'mpt', 'mpat', 'mpta', 'a','at','t'];
	var ROUTER_FNS_SELECTOR_MAP = {
		p:'path',
		m:'method',
		a:'accept',
		t:'content-type'
	};

	// definitions/helpers about the composition of the request object
	var nonheaders = ['path','method','query','body','stream'];
	function isHeader(key) {
		return (nonheaders.indexOf(key) === -1);
	}
	function getRequestValue(request, key) {
		if (isHeader(key)) {
			if (request.headers) {
				return request.headers[key];
			}
			return null;
		}
		return request[key];
	}

	// array helper
	function has(arr, v) { return (arr.indexOf(v) !== -1); }

	function convertSelectorToRegexp(selector) {
		if (selector instanceof RegExp) { return selector; }
		// arrays are ORed together (`['a','b','c']`->`/a|b|c/`)
		if (Array.isArray(selector)) { return new RegExp('^'+selector.join('|')+'$', 'gi'); }
		return new RegExp('^'+selector+'$', 'gi');
	}

	// Router
	// ======
	// a message -> behavior routing helper for servers
	// - `request` should be the `request` param of the server's request handler fn
	function Router(request) {
		this.request   = request;
		this.isRouted  = false; // has one of the routes hit yet?
		this.bestMatch = []; // a set of parameters which were hit during our closest match
	}

	// calls the given cb if the request matches the given selectors
	Router.prototype.route = function(selectors, cb) {
		// sanity check
		if (typeof cb !== 'function') {
			throw new Error('a handler callback must be given to the route');
		}

		if (this.isRouted) { return this; } // no more routing

		// test the request against selectors
		var m, v, selector;
		var matchedResults = {}, matchedKeys = [];
		var isMatch = true;
		for (var key in selectors) {
			// extract testing data
			selector = selectors[key];
			v = getRequestValue(this.request, key);

			// make sure all paths start with a /
			if (key == 'path' && v.charAt(0) != '/') {
				v = '/' + v;
			}

			// run test
			m = selector.exec(v);

			if (m !== null && m !== false) { // match
				matchedResults[key] = m;
				matchedKeys.push(key);
			} else { // miss
				isMatch = false;
				// best match is the match the most valid keys
				// - gives preference to path and method hits
				// :NOTE: child matches (that is, matches made in the callback) do not currently include the parent's bestMatch
				if ((has(matchedKeys, 'path') || has(matchedKeys, 'method')) && matchedKeys.length > this.bestMatch.length) {
					this.bestMatch = matchedKeys;
				}
			}
		}

		if (isMatch) {
			// successful match, run the callback
			cb.call(this, matchedResults);
			this.isRouted = true;
		}
		
		return this;
	};

	// error-response generator
	// - uses the partial match history to construct an intelligent response (eg if a url hit once, it's not a 404)
	// - should be called at the end of a routing structure
	// - add parameter names to `ignores` to assume those parameters did match
	//   (corrects sub-routing error-reporting, where parent matches to the callback are not included)
	Router.prototype.error = function(response, ignores) {
		if (this.isRouted) { return this; }
		var respond = Link.responder(response);
		var bestMatch = this.bestMatch.concat(ignores);
		if      (!has(bestMatch, 'path')) { respond.notFound().end(); }
		else if (!has(bestMatch, 'method')) { respond.methodNotAllowed().end(); }
		else if (!has(bestMatch, 'content-type') && this.request.body ) { respond.unsupportedMediaType().end(); }
		else if (!has(bestMatch, 'accept') && this.request.headers.accept) { respond.notAcceptable().end(); }
		else    { respond.badRequest().end(); }
	};

	// add router sugars
	ROUTER_FNS.forEach(function addRouterFn(fnName) {
		// build an array of selector names
		// eg 'rma' -> `['url','method','accept']`
		var selectors = fnName.split('').map(function(abbrev) { return ROUTER_FNS_SELECTOR_MAP[abbrev]; });
		// add function
		Router.prototype[fnName] = function() {
			// build the `route` call out of the function name by mapping the parameters to a selector object
			// eg `rma = function(url, method, accept, cb)` -> `route({ url:arg0, method:arg1, accept:arg2 }, arg3)`
			var selectorStructure = {};
			var argIndex=0;
			for (argIndex; argIndex < selectors.length; argIndex++) {
				var selector = selectors[argIndex];
				selectorStructure[selector] = convertSelectorToRegexp(arguments[argIndex]);
			}
			var cb = arguments[argIndex];
			return this.route(selectorStructure, cb);
		};
	});

	// adds a type alias for use in the responder functions
	// - eg html -> text/html
	Router.setTypeAlias = function(alias, mimetype) {
		typeAliases[alias] = mimetype;
	};

	// wrap helper
	function router(request) {
		return (request instanceof Router) ? request : new Router(request);
	}

	exports.Router = Router;
	exports.router = router;
})(Link);// MyHouse
// =======
// pfraze 2012
var MyHouse = {};

(function (exports) {
	var cur_mid = 1;
	function gen_mid() { return cur_mid++; }

	// Sandbox
	// =======
	// EXPORTED
	// wraps a Web Worker API tools for sandboxing and messaging
	// - should be used by the environment hosting the workers (most likely the document)
	// - loads the worker with the MyHouse bootstrap script
	// - `options.bootstrapUrl` may optionally specify the URL of MyHouse's worker bootstrap script
	// - `options.log` will enable logging of traffic
	function Sandbox(readyCb, options) {
		options = options || {};
		this.isLogging = options.log;

		this.messageListeners = {};
		this.replyCbs = {};
		this.messageBuffers = {};

		if (readyCb) {
			this.onMessage('ready', readyCb, this);
		}

		this.worker = new Worker(options.bootstrapUrl || 'worker-bootstrap.js');
		setupMessagingHandlers.call(this);
	}

	// INTERNAL
	// registers listeners required for messaging
	function setupMessagingHandlers() {
		var self = this;
		this.worker.addEventListener('message', function(event) {
			var message = event.data;
			if (this.isLogging) { console.log('receiving', message); }

			// handle replies
			if (message.name === 'reply') {
				var cb = self.replyCbs[message.reply_to];
				if (cb) {
					cb.func.call(cb.context, message);
					delete self.replyCbs[message.reply_to]; // wont need to call again
					return;
				}
			}

			var listeners = self.messageListeners[message.name];

			// streaming
			if (message.name === 'endMessage') {
				var mid = message.data;
				listeners = self.messageListeners[mid]; // inform message listeners
				self.removeAllMessageListeners(mid); // and release their references
			}

			// dispatch
			if (listeners) {
				listeners.forEach(function(listener) {
					listener.func.call(listener.context, message);
				});
			}
		});
	}

	// EXPORTED
	// sends a message to the sandbox
	// - `messageName` is required
	// - returns id of the new message
	// - if `replyCb` is specified, it will be called once if/when the sandbox sends a reply to the message
	// - to send more data afterwards (streaming) use the returned id as the message name
	Sandbox.prototype.postMessage = function(messageName, messageData, replyCb, replyCbContext) {
		var message = makeMessage(messageName, messageData);
		doPostMessage.call(this, message, replyCb, replyCbContext);
		return message.id;
	};

	// EXPORTED
	// sends a reply to a message from the sandbox
	// - parameter 1 (`orgMessage`) should be the message (or id of the message) originally received from the sandbox
	// - otherwise works exactly like postMessage
	// - NOTE: replies will only be handled by replyCbs registered during the original send
	//   - if a sender is not expecting a reply, it will never be handled
	Sandbox.prototype.postReply = function(orgMessage, messageData, replyCb, replyCbContext) {
		var replyToID = (typeof orgMessage === 'object') ? orgMessage.id : orgMessage;
		var message = makeMessage('reply', messageData, replyToID);
		doPostMessage.call(this, message, replyCb, replyCbContext);
		return message.id;
	};

	// EXPORTED
	// informs the receiver that no more data will stream, allowing it to release its listeners
	// - parameter 1 (`orgMessageID`) should be the first message's id (returned by postMessage/postReply)
	Sandbox.prototype.endMessage = function(orgMessageID) {
		return this.postMessage('endMessage', orgMessageID);
	};

	// INTERNAL
	// message object builder
	function makeMessage(name, data, replyToId) {
		var message = {
			id       : gen_mid(),
			reply_to : replyToId,
			name     : name,
			data     : data
		};
		return message;
	}

	// INTERNAL
	// functional body of the post* functions
	// - should be called with the Sandbox bound to `this`
	function doPostMessage(message, replyCb, replyCbContext) {
		if (message.name in this.messageBuffers) {
			// dont send; queue message in the buffer
			this.messageBuffers[message.name].push([message, replyCb, replyCbContext]);
		} else {
			if (replyCb && typeof replyCb === 'function') {
				this.replyCbs[message.id] = { func:replyCb, context:replyCbContext };
			}
			if (this.isLogging) { console.log('sending', message); }
			this.worker.postMessage(message);
		}
	}

	// EXPORTED
	// registers a callback to handle messages from the sandbox
	// - `messageName` and `func` are required
	Sandbox.prototype.addMessageListener = function(messageName, func, context) {
		if (!(messageName in this.messageListeners)) {
			// create new listener array
			this.messageListeners[messageName] = [];
		}
		// add to list
		this.messageListeners[messageName].push({ func:func, context:context });
	};
	Sandbox.prototype.onMessage = Sandbox.prototype.addMessageListener;

	// EXPORTED
	// removes a given callback from the message listeners
	Sandbox.prototype.removeMessageListener = function(messageName, func) {
		if (messageName in this.messageListeners) {
			// filter out the listener
			var filterFn = function(listener) { return listener.func != func; };
			this.messageListeners[messageName] = this.messageListeners[messageName].filter(filterFn);
			// remove array if empty
			if (this.messageListeners[messageName].length === 0) {
				delete this.messageListeners[messageName];
			}
		}
	};

	// EXPORTED
	// removes all callbacks from the given message
	Sandbox.prototype.removeAllMessageListeners = function(messageName) {
		if (messageName in this.messageListeners) {
			delete this.messageListeners[messageName];
		}
	};

	// EXPORTED
	// delays all messages of the given type until `releaseMessages` is called
	Sandbox.prototype.bufferMessages = function(messageName) {
		if (!(messageName in this.messageBuffers)) {
			this.messageBuffers[messageName] = [];
		}
	};

	// EXPORTED
	// stops buffering and sends all queued messages
	Sandbox.prototype.releaseMessages = function(messageName) {
		if (messageName in this.messageBuffers) {
			var buffers = this.messageBuffers[messageName];
			delete this.messageBuffers[messageName]; // clear the entry, so `doPostMessage` knows to send
			buffers.forEach(function(buffer) {
				doPostMessage.apply(this, buffer);
			}, this);
		}
	};

	// EXPORTED
	// instructs the sandbox to set the given name to null
	// - eg sandbox.nullify('XMLHttpRequest'); // no ajax
	Sandbox.prototype.nullify = function(name) {
		this.postMessage('nullify', name);
	};

	// EXPORTED
	// instructs the sandbox to import the JS given by the URL
	// - eg sandbox.importJS('/my/script.js', onImported);
	// - urls may be a string or an array of strings
	// - note, `urls` may contain data-urls of valid JS
	// - `cb` is called with the respond message
	//   - on error, .data will be { error:true, reason:'message' }
	Sandbox.prototype.importScripts = function(urls, cb) {
		this.postMessage('importScripts', urls, cb);
	};

	// EXPORTED
	// destroys the sandbox
	Sandbox.prototype.terminate = function() {
		// just to be safe about callbacks, lets drop all our listeners
		// :TODO: does this do anything?
		var k; // just shut up, JSLint
		for (k in this.messageListeners) {
			delete this.messageListeners[k];
		}
		for (k in this.replyCbs) {
			delete this.replyCbs[k];
		}
		// kill the worker
		this.worker.terminate();
		this.worker = null;
	};

	exports.Sandbox = Sandbox;

})(MyHouse);

// set up for node or AMD
if (typeof module !== "undefined") {
	module.exports = MyHouse;
}
else if (typeof define !== "undefined") {
	define([], function() {
		return MyHouse;
	});
}// CommonClient
// ============
// pfraze 2012
var CommonClient = {};

(function (exports) {

	// Standard DOM Events
	// ===================

	// listen()
	// ======
	// EXPORTED
	// begins event-interception with the given element
	// - within the container, all 'click' and 'submit' events will be consumed
	// - 'request' events will be dispatched by the original dispatching element
	// - draggable elements which produce requests (anchors, form elements) have their drag/drop handlers defined as well
	// parameters:
	// - `container` must be a valid DOM element
	// - `options` may disable event listeners by setting `links`, `forms`, or `dragdrops` to false
	function CommonClient__listen(container, options) {
		if (!container || !(container instanceof Element)) {
			throw "Listen() requires a valid DOM element as a first parameter";
		}

		container.__eventHandlers = [];
		options = options || {};

		var handler;
		if (options.links !== false) {
			handler = { handleEvent:CommonClient__clickHandler, container:container };
			container.addEventListener('click', handler);
			container.__eventHandlers.push(handler);
		}
		if (options.forms !== false) {
			handler = { handleEvent:CommonClient__submitHandler, container:container };
			container.addEventListener('submit', handler);
		}
		if (options.dragdrops !== false) {
			handler = { handleEvent:CommonClient__dragstartHandler, container:container };
			container.addEventListener('dragstart', handler);
			container.__eventHandlers.push(handler);
		}
	}
	function CommonClient__unlisten(container) {
		if (container.__eventHandlers) {
			container.__eventHandlers.forEach(function(handler) {
				container.removeEventListener(handler);
			});
			delete container.__eventHandlers;
		}
		var subscribeElems = container.querySelectorAll('[data-subscribe]');
		Array.prototype.forEach.call(subscribeElems, function(subscribeElem) {
			if (subscribeElem.__subscriptions) {
				for (var url in subscribeElem.__subscriptions) {
					subscribeElem.__subscriptions[url].close();
				}
				delete subscribeElem.__subscriptions;
			}
		});
	}

	// INTERNAL
	// transforms click events into request events
	function CommonClient__clickHandler(e) {
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
	function CommonClient__submitHandler(e) {
		var request = extractRequest(e.target, this.container);
		if (request && ['_top','_blank'].indexOf(request.target) !== -1) { return; }
		if (request) {
			e.preventDefault();
			e.stopPropagation();
			dispatchRequestEvent(e.target, request);
			return false;
		}
	}

	// INTERNAL
	// builds a 'link' object out of a dragged item
	function CommonClient__dragstartHandler(e) {
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

	exports.listen = CommonClient__listen;
	exports.unlisten = CommonClient__unlisten;

	// Response Interpretation
	// =======================

	// handleResponse()
	// ==============
	// EXPORTED
	// examines a request's response and inserts it into the DOM according to rules
	function CommonClient__handleResponse(targetElem, containerElem, response) {
		response.headers = response.headers || {};

		// react to the response
		switch (response.status) {
		case 204:
			// no content
			break;
		case 205:
			// reset form
			// :TODO: should this try to find a parent form to targetElem?
			if (targetElem.tagName === 'FORM') {
				targetElem.reset();
			}
			break;
		case 303:
			// dispatch for contents
			var request = { method:'get', url:response.headers.location, headers:{ accept:'text/html' }};
			dispatchRequestEvent(targetElem, request);
			break;
		default:
			// replace target innards
			renderResponse(targetElem, containerElem, response);
		}
	}

	// INTERNAL
	// replaces the targetElem's innerHTML with the response payload
	function renderResponse(targetElem, containerElem, response) {

		if (response.body) {
			var type = response.headers['content-type'];
			if (/application\/html\-deltas\+json/.test(type)) {
				if (typeof response.body != 'object')
					console.log('Improperly-formed application/html-deltas+json object', response);
				else {
					for (var op in response.body)
						renderHtmlDeltas(op, response.body[op], targetElem, containerElem);
				}
			} else {
				var html = '';
				if (/text\/html/.test(type))
					html = response.body.toString();
				else {
					// escape non-html so that it can render correctly
					if (typeof response.body == 'string')
						html = response.body.replace(/</g, '&lt;').replace(/>/g, '&gt;');
					else
						html = JSON.stringify(response.body);
				}
				targetElem.innerHTML = html;
			}
		}

		bindAttrEvents(targetElem, containerElem);
		subscribeElements(targetElem, containerElem);
	}

	function renderHtmlDeltas(op, deltas, targetElem, containerElem) {
		if (typeof deltas != 'object')
			return;
		for (var selector in deltas) {
			var i, ii, elems = containerElem.querySelectorAll(selector);
			var addClass = function(cls) { elems[i].classList.add(cls); };
			var removeClass = function(cls) { elems[i].classList.remove(cls); };
			var toggleClass = function(cls) { elems[i].classList.toggle(cls); };
			for (i=0, ii=elems.length; i < ii; i++) {
				if (!elems[i]) continue;
				switch (op) {
					case 'replace':
						elems[i].innerHTML = deltas[selector];
						break;
					case 'append':
						elems[i].innerHTML = elems[i].innerHTML + deltas[selector];
						break;
					case 'prepend':
						elems[i].innerHTML = deltas[selector] + elems[i].innerHTML;
						break;
					case 'addClass':
						if (elems[i].classList)
							deltas[selector].split(' ').forEach(addClass);
						break;
					case 'removeClass':
						if (elems[i].classList)
							deltas[selector].split(' ').forEach(removeClass);
						break;
					case 'toggleClass':
						if (elems[i].classList)
							deltas[selector].split(' ').forEach(toggleClass);
						break;
				}
			}
		}
	}

	exports.handleResponse = CommonClient__handleResponse;

	// Event Attributes
	// ================

	// supported extra events
	var attrEvents = ['blur', 'change', 'click', 'dblclick', 'focus', 'keydown', 'keypress', 'keyup', 'load', 'mousedown', 'mousemove', 'mouseout', 'mouseover', 'mouseup', 'reset', 'select', 'submit', 'unload'];

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
			// build request
			request = extractRequest(e.currentTarget, containerElem);
			request.method = method;

			// move the params into the body if not a GET
			// (extractRequest would have used the wrong method to judge this)
			if (/GET/i.test(method) === false && !request.body) {
				request.body = request.query;
				delete request.query;
			}

			// dispatch request event
			if (request) {
				e.preventDefault();
				e.stopPropagation();
				dispatchRequestEvent(e.target, request);
				return false;
			}
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
			var url = subscribeElem.dataset['subscribe'];
			subscribeElem.__subscriptions = subscribeElem.__subscriptions || {};
			var stream = subscribeElem.__subscriptions[url];
			if (!stream)
				stream = subscribeElem.__subscriptions[url] = Link.subscribe({ url:url });
			stream.on('update', makeUpdateEventHandler(url, subscribeElem));
			stream.on('error', makeErrorEventHandler());
		});
	}

	function makeUpdateEventHandler(url, targetElem) {
		return function(m) {
			var request = { method:'get', url:url, target:"_element", headers:{ accept:'text/html' }};
			dispatchRequestEvent(targetElem, request);
		};
	}

	function makeErrorEventHandler() {
		return function(e) {
			var err = e.data;
			console.log('Client update stream error:', err);
		};
	}

	// Helpers
	// =======

	// INTERNAL
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
				if (!obj[k]) { continue; }
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

	// INTERNAL
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

	// INTERNAL
	// extracts request parameters from an anchor tag
	extractRequest.fromAnchor = function(node) {

		// get the anchor
		node = findParentNode.byTag(node, 'A');
		if (!node) { return null; }

		// pull out params
		var request = {
			method  : 'get',
			url     : node.attributes.href.value,
			target  : node.getAttribute('target'),
			headers : { accept:node.getAttribute('type') }
		};
		return request;
	};

	// INTERNAL
	// extracts request parameters from a form element (inputs, textareas, etc)
	extractRequest.fromFormElement = function(node) {
		
		// :TODO: search parent for the form-related element?
		//        might obviate the need for submitter-tracking

		// pull out params
		var request = {
			method  : node.getAttribute('formmethod'),
			url     : node.getAttribute('formaction'),
			target  : node.getAttribute('formtarget'),
			headers : { 'content-type':node.getAttribute('formenctype') }
		};
		return request;
	};

	// INTERNAL
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
				headers : { 'content-type':submittingElem.getAttribute('formenctype') }
			};
		}
		// extract form headers
		requests.form = {
			method  : form.getAttribute('method'),
			url     : form.getAttribute('action'),
			target  : form.getAttribute('target'),
			headers : { 'content-type':form.getAttribute('enctype') || form.enctype }
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

	// INTERNAL
	// serializes all form elements beneath and including the given element
	function extractRequestPayload(targetElem, form) {

		// iterate form elements
		var data = {};
		for (var i=0; i < form.length; i++) {
			var elem = form[i];

			// skip if not a child of the target element
			if (!findParentNode.byElement(elem, targetElem)) {
				continue;
			}

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
					default:
						data[elem.name] = elem.value;
						break;
				}
			} else
				data[elem.name] = elem.value;
		}

		return data;
	}

	exports.findParentNode = findParentNode;
	exports.extractRequest = extractRequest;

})(CommonClient);

// set up for node or AMD
if (typeof module !== "undefined") {
	module.exports = CommonClient;
}
else if (typeof define !== "undefined") {
	define([], function() {
		return CommonClient;
	});
}// LinkAP Environment
// ==================
// pfraze 2012
var Environment = {};(function(exports) {
	var cur_id = 1;
	function gen_id() { return cur_id++; }

	// Server
	// ======
	// EXPORTED
	// core type for all servers, should be used as a prototype
	function Server() {
		this.config = { id:gen_id(), domain:null };
		this.state = Server.BOOT;
		this.environment = null; // will be set by Environment.addServer
	}

	// EXPORTED
	// possible states
	Server.BOOT   = 0; // initial, not ready to do work
	Server.READY  = 1; // local bootstrap is loaded, awaiting user script
	Server.ACTIVE = 2; // local bootstrap and user script loaded, server may handle requests
	Server.DEAD   = 3; // should be cleaned up

	// request handler, should be overwritten by subclasses
	Server.prototype.handleHttpRequest = function(request, response) {
		response.writeHead(0, 'server not implemented');
		response.end();
	};

	// marks the server for cleanup
	Server.prototype.terminate = function() {
		this.state = Server.DEAD;
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
	// - `config` must include `scriptUrl` or `script`
	function WorkerServer(config, loaderrorCb) {
		Server.call(this);
		if (config) {
			for (var k in config)
				this.config[k] = config[k];
		}

		if (!this.config.domain) {
			this.config.domain = (this.config.scriptUrl) ?
				'<'+this.config.scriptUrl+'>' :
				'{'+this.config.script.slice(0,20)+'}';
		}
		this.config.environmentHost = window.location.host;
		this.loaderrorCb = loaderrorCb;
		this.readyMessage = null;
		this.canLoadUserscript = false;

		// initialize the web worker with the MyHouse bootstrap script
		this.worker = new MyHouse.Sandbox(null, { bootstrapUrl:Environment.config.workerBootstrapUrl });
		this.worker.bufferMessages('httpRequest'); // queue http requests until the app script is loaded
		this.worker.onMessage('ready', this.onWorkerReady, this);
		this.worker.onMessage('terminate', this.terminate, this);
		this.worker.onMessage('httpRequest', this.onWorkerHttpRequest, this);
		this.worker.onMessage('httpSubscribe', this.onWorkerHttpSubscribe, this);
		this.worker.onMessage('log', this.onWorkerLog, this);
	}
	WorkerServer.prototype = Object.create(Server.prototype);

	// runs Local initialization for a worker thread
	// - called when the myhouse worker_bootstrap has finished loading
	WorkerServer.prototype.onWorkerReady = function(message) {
		// disable dangerous APIs
		this.worker.nullify('XMLHttpRequest');
		this.worker.nullify('Worker');
		// hold onto the ready message and update state, so the environment can finish preparing us
		// (the config must be locked before we continue from here)
		this.state = Server.READY;
		this.readyMessage = message;
		if (this.canLoadUserscript)
			this.loadUserScript();
	};

	WorkerServer.prototype.loadUserScript = function() {
		// flag that the environment is ready for us
		this.canLoadUserscript = true;
		if (this.state != Server.READY)
			return; // wait for the worker to be ready
		// send config to the worker thread
		this.worker.postReply(this.readyMessage, this.config);
		// load the server program
		var url = this.config.scriptUrl;
		if (!url && this.config.script) {
			// convert the given source to an object url
			var jsBlob = new Blob([this.config.script], { type:'application/javascript' });
			url = (window.webkitURL ? webkitURL : URL).createObjectURL(jsBlob);
		}
		var self = this;
		this.worker.importScripts(url, function(importRes) {
			if (importRes.data.error) {
				if (self.loaderrorCb) self.loaderrorCb(importRes.data);
				self.terminate();
				return;
			}
			if (self.state != Server.DEAD) {
				self.state = Server.ACTIVE;
				self.worker.releaseMessages('httpRequest'); // stop buffering
			}
		});
	};

	// destroys the server
	// - called when the worker has died, or when the environment wants the server to die
	WorkerServer.prototype.terminate = function() {
		this.state = Server.DEAD;
		this.worker.terminate();
	};

	// retrieve server source
	// - `requester` is the object making the request
	WorkerServer.prototype.getSource = function(requester) {
		var scriptUrl = this.config.scriptUrl;
		if (scriptUrl) {
			var scriptPromise = Local.promise();
			if (/\/\//.test(scriptUrl) === false) { // no protocol?
				// assume it's a relative path referring to our host
				scriptUrl = 'http://'+window.location.host + scriptUrl;
			}

			// request from host
			var jsRequest = { method:'get', url:scriptUrl, headers:{ accept:'application/javascript' }};
			Link.dispatch(jsRequest, requester).then(
				function(res) {
					res.on('end', function() {
						scriptPromise.fulfill(res.body);
					});
				},
				function(err) {
					console.log('failed to retrieve worker source:', err.message, err.response);
					scriptPromise.reject(err);
				}
			);
			return scriptPromise;
		} else {
			return this.config.script;
		}
	};

	// logs the message data
	// - allows programs to run `app.postMessage('log', 'my log message')`
	WorkerServer.prototype.onWorkerLog = function(message) {
		console.log('['+this.config.domain+']', message.data);
	};

	// dispatches a request to Link and sends the response back to the worker
	// - called when the worker-server issues a request
	// - mirrors app.onMessage('httpRequest') in worker_core.js
	WorkerServer.prototype.onWorkerHttpRequest = function(message) {
		var self = this;
		var request = message.data;

		// pipe the response back to the worker
		var handleResponse = function(response) {
			var stream = self.worker.postReply(message, response);
			response.on('data', function(data) { self.worker.postMessage(stream, data); });
			response.on('end', function() { self.worker.endMessage(stream); });
		};

		// all errors, just send back to the worker
		var handleErrors = function(err) {
			var stream = self.worker.postReply(message, err.response);
			self.worker.endMessage(stream);
		};

		// execute the request
		Local.promise(Link.dispatch(message.data, this)).then(handleResponse, handleErrors);
	};

	// routes the subscribe to Link and sends the events back to the worker
	// - called when the worker-server issues a subscribe
	WorkerServer.prototype.onWorkerHttpSubscribe = function(message) {
		var self = this;
		var request = message.data;

		// create the stream
		// :TODO: no close handling... is this a memory leak?
		var eventStream = Link.subscribe(request);

		// listen for further requests - they indicate individual message subscribes
		this.worker.onMessage(message.id, function(message2) {
			var eventNames = message2.data;
			var msgStream = self.worker.postReply(message2);
			// begin listening
			eventStream.on(eventNames, function(e) {
				// pipe back
				self.worker.postMessage(msgStream, e);
			});
		});
	};

	// dispatches the request to the sandbox for handling
	// - called when a request is issued to the worker-server
	// - mirrors Link.setRequestDispatcher(function) in worker_core.js
	WorkerServer.prototype.handleHttpRequest = function(request, response) {
		this.worker.postMessage('httpRequest', request, function(reply) {
			if (!reply.data) { throw "Invalid httpRequest reply to document from worker"; }

			response.writeHead(reply.data.status, reply.data.reason, reply.data.headers);
			if (typeof reply.data.body != 'undefined' && reply.data.body !== null)
				response.write(reply.data.body);

			this.worker.onMessage(reply.id, function(streamMessage) {
				if (streamMessage.name === 'endMessage') {
					response.end();
				} else {
					// :TODO: update headers?
					response.write(streamMessage.data);
				}
			});
		}, this);
	};

	exports.Server = Server;
	exports.WorkerServer = WorkerServer;
})(Environment);(function(exports) {

	// ClientRegion
	// ============
	// EXPORTED
	// an isolated region of the DOM
	function ClientRegion(id) {
		this.id = id;
		this.context = {
			url   : '',
			urld  : {},
			links : [],
			type  : '' // content type of the response
		};

		this.element = document.getElementById(id);
		if (!this.element) { throw "ClientRegion target element not found"; }

		this.element.addEventListener('request', handleRequest.bind(this));
		CommonClient.listen(this.element);
	}

	ClientRegion.prototype.dispatchRequest = function(request) {
		if (typeof request === 'string') {
			request = { method:'get', url:request, headers:{ accept:'text/html' }};
		}
		var re = new CustomEvent('request', { bubbles:true, cancelable:true, detail:request });
		this.element.dispatchEvent(re);
	};

	ClientRegion.prototype.terminate = function() {
		CommonClient.unlisten(this.element);
		this.element.removeEventListener('request', this.listenerFn);
	};

	function handleRequest(e) {
		e.preventDefault();
		e.stopPropagation();

		var request = e.detail;

		var self = this;
		this.__prepareRequest(request);
		Local.promise(Link.dispatch(request, this)).then(
			function(response) {
				self.__handleResponse(e, request, response);
			},
			function(err) {
				self.__handleResponse(e, request, err.response);
			}
		);
	}

	ClientRegion.prototype.__prepareRequest = function(request) {
		// sane defaults
		request.headers = request.headers || {};
		request.headers.accept = request.headers.accept || 'text/html';
		request.stream = false;

		// relative urls
		var urld = Link.parseUri(request);
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
			} while (newUrl != request.url && Link.parseUri(newUrl).host == lastRequestHost);
			delete request.host;
			delete request.path;
		}
	};

	ClientRegion.prototype.__updateContext = function(request, response) {
		// track location for relative urls
		var urld = Link.parseUri(request);
		this.context.urld  = urld;
		this.context.url   = urld.protocol + '://' + urld.authority + urld.directory;
		this.context.links = response.headers.link;
		this.context.type  = response.headers['content-type'];
	};

	ClientRegion.prototype.__handleResponse = function(e, request, response) {
		var requestTarget = this.__chooseRequestTarget(e, request);
		var targetClient = Environment.getClientRegion(requestTarget.id);
		if (targetClient)
			targetClient.__updateContext(request, response);
		CommonClient.handleResponse(requestTarget, this.element, response);
		Environment.postProcessRegion(requestTarget);
	};

	ClientRegion.prototype.__chooseRequestTarget = function(e, request) {
		if (request.target == '_element')
			return e.target;
		return document.getElementById(request.target) || this.element;
	};

	exports.ClientRegion = ClientRegion;
})(Environment);(function(exports) {

	exports.config = {
		workerBootstrapUrl : 'lib/worker-server.min.js'
	};

	exports.servers = {};
	exports.clientRegions = {};
	exports.numServers = 0;
	exports.numClientRegions = 0;

	exports.addServer = function(domain, server) {
		// instantiate the application
		server.environment = this;
		server.config.domain = domain;
		Environment.servers[domain] = server;
		Environment.numServers++;

		// allow the user script to load
		if (server.loadUserScript)
			server.loadUserScript();

		// register the server
		Link.registerLocal(domain, server.handleHttpRequest, server);

		return server;
	};

	exports.killServer = function(domain) {
		var server = Environment.servers[domain];
		if (server) {
			Link.unregisterLocal(domain);
			server.terminate();
			delete Environment.servers[domain];
			Environment.numServers--;
		}
	};

	exports.getServer = function(domain) { return Environment.servers[domain]; };
	exports.listFilteredServers = function(fn) {
		var list = {};
		for (var k in Environment.servers) {
			if (fn(Environment.servers[k], k)) list[k] = Environment.servers[k];
		}
		return list;
	};

	exports.addClientRegion = function(clientRegion) {
		var id;
		if (typeof clientRegion == 'object') {
			id = clientRegion.id;
		} else {
			id = clientRegion;
			clientRegion = new Environment.ClientRegion(id);
		}
		Environment.clientRegions[clientRegion.id] = clientRegion;
		Environment.numClientRegions++;
		return clientRegion;
	};

	exports.removeClientRegion = function(id) {
		if (Environment.clientRegions[id]) {
			Environment.clientRegions[id].terminate();
			delete Environment.clientRegions[id];
			Environment.numClientRegions--;
		}
	};

	exports.getClientRegion = function(id) { return Environment.clientRegions[id]; };

	// dispatch monkeypatch
	// - allows the environment to control request permissions / sessions / etc
	// - adds the `origin` parameter, which is the object responsible for the request
	var envDispatchWrapper;
	var orgLinkDispatchFn = Link.dispatch;
	Link.dispatch = function(req, origin) {
		var res = envDispatchWrapper.call(this, req, origin, orgLinkDispatchFn);
		if (res instanceof Local.Promise) { return res; }

		// make sure we respond with a valid client response
		if (!res) {
			res = new Link.ClientResponse(0, 'Environment did not correctly dispatch the request');
		} else if (!(res instanceof Link.ClientResponse)) {
			if (typeof res == 'object') {
				var res2 = new Link.ClientResponse(res.status, res.reason);
				res2.headers = res.headers;
				res2.end(res.body);
				res = res2;
			} else {
				res = new Link.ClientResponse(0, res.toString());
			}
		}

		// and make sure it's wrapped in a promise
		var p = Local.promise();
		if (res.status >= 400) {
			p.reject(res);
		} else {
			p.fulfill(res);
		}
		return p;
	};
	envDispatchWrapper = function(req, origin, dispatch) {
		return dispatch(req);
	};
	exports.setDispatchWrapper = function(fn) {
		envDispatchWrapper = fn;
	};

	// response html post-process
	// - override this to modify html after it has entered the document
	// - useful for adding environment widgets
	exports.postProcessRegion = function(elem) { return this.__postProcessRegion(elem); };
	exports.__postProcessRegion = function() {};
	exports.setRegionPostProcessor = function(fn) {
		this.__postProcessRegion = fn;
	};
})(Environment);// set up for node or AMD
if (typeof module !== "undefined") {
	module.exports = App;
}
else if (typeof define !== "undefined") {
	define([], function() {
		return App;
	});
}