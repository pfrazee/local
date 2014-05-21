var util = require('../util');
var promises = require('../promises.js');
var helpers = require('./helpers.js');
var schemes = require('./schemes.js');
var contentTypes = require('./content-types.js');
var Response = require('./response.js');
var IncomingResponse = require('./incoming-response.js');

// Request
// =======
// EXPORTED
// Interface for sending requests
function Request(headers, originChannel) {
	util.EventEmitter.call(this);
	promises.Promise.call(this);
	if (!headers) headers = {};
	if (typeof headers == 'string') headers = { url: headers };

	// Request definition
	// headers is an object containing method, url, params (the query params) and the header values (as uppercased keys)
	this.headers = headers;
	this.headers.method = (this.headers.method) ? this.headers.method.toUpperCase() : 'GET';
	this.headers.params = (this.headers.params) || {};
	this.originChannel = originChannel;
	this.isBinary = false; // stream is binary?
	this.isVirtual = local.virtualOnly || undefined; // request going to virtual host?

	// Behavior flags
    this.isForcedLocal = local.localOnly; // forcing request to be local
	this.isBufferingResponse = true; // auto-buffering the response?
	this.isAutoEnding = false; // auto-ending the request on next tick?

	// Stream state
	this.isConnOpen = true;
	this.isStarted = false;
	this.isEnded = false;
}
Request.prototype = Object.create(util.EventEmitter.prototype);
util.mixin.call(Request.prototype, promises.Promise.prototype);
Request.fulfillResponsePromise = fulfillResponsePromise;
module.exports = Request;

// Header setter
Request.prototype.header = function(k, v) {
	k = formatHeaderKey(k);
	// Convert mime if needed
	if (k == 'Accept' || k == 'ContentType') {
		v = contentTypes.lookup(v);
	}
	this.headers[k] = v;
	return this;
};

// Header sugars
[ 'Accept', 'Authorization', 'ContentType', 'Expect', 'From', 'Pragma' ].forEach(function(k) {
	Request.prototype[k] = function(v) {
		return this.header(k, v);
	};
});

// helper to convert a given header value to our standard format - camel case, no dashes
var headerKeyRegex = /(^|-)(.)/g;
function formatHeaderKey(str) {
	// strip any dashes, convert to camelcase
	// eg 'foo-bar' -> 'FooBar'
	return str.replace(headerKeyRegex, function(_0,_1,_2) { return _2.toUpperCase(); });
}

// Content-type sugars
[ 'json', 'text', 'html', 'csv' ].forEach(function(k) {
    Request.prototype[k] = function (v) {
        this.ContentType(k);
        this.write(v);
        return this;
    };
    Request.prototype['to'+k] = function (v) {
        this.Accept(k);
        return this;
    };
});

// Param setter
// - `k` may be an object of keys to add
// - or `k` can be the keyname and `v` the value
// - eg: req.param({ foo: 'bar', hot: 'dog' })
//       req.param('foo', 'bar').param('hot', 'dog')
Request.prototype.param = function(k, v) {
	if (k && typeof k == 'object') {
		for (var k2 in k) {
			this.param(k2, k[k2]);
		}
	} else {
		this.headers.params[k] = v;
	}
	return this;
};

// Request timeout setter
// causes the request/response to abort after the given milliseconds
Request.prototype.setTimeout = function(ms) {
	var self = this;
	if (this.__timeoutId) return;
	this.__timeoutId = setTimeout(function() {
		if (self.isConnOpen) { self.close(); }
		delete self.__timeoutId;
	}, ms);
	return this;
};

// Binary mode
// causes the request and response to use binary
// - if no bool is given, sets binary-mode to true
Request.prototype.setBinary = function(v) {
	if (typeof v == 'boolean') {
		this.isBinary = v;
	} else {
		this.isBinary = true;
	}
	return this;
};


// Virtual mode
// overrides the automatic decision as to whether to route to virtual or remote endpoints
// - (true) -> will route to local or worker endpoints
// - (false) -> will route to remote endpoints
// - if no bool is given, sets to true
Request.prototype.setVirtual = function(v) {
	this.isVirtual = (v !== void 0) ? v : true;
	return this;
};

// Forced local
// instructs the request to only route to endpoints in the current page
Request.prototype.forceLocal = function(v) {
	if (typeof v == 'boolean') {
		this.isForcedLocal = v;
	} else {
		this.isForcedLocal = true;
	}
	return this;
};

// Response buffering
// instructs the request to auto-buffer the response body and set it to `res.body`
Request.prototype.bufferResponse = function(v) {
	if (typeof v == 'boolean') {
		this.isBufferingResponse = v;
	} else {
		this.isBufferingResponse = true;
	}
	return this;
};

// Auto-end
// queues a callback next tick to end the stream, for non-streaming requests
Request.prototype.autoEnd = function(v) {
	v = (typeof v != 'undefined') ? v : true;
	if (v && !this.isAutoEnding) {
		// End next tick
		var self = this;
		util.nextTick(function() {
			if (self.isAutoEnding) { // still planned?
				self.end(); // send next tick
			}
		});
	}
	this.isAutoEnding = v;
};

// Pipe helper
// passes through to its incoming response
Request.prototype.pipe = function(target, headersCb, bodyCb) {
	if (target.autoEnd) {
		target.autoEnd(false); // disable auto-ending, we are now streaming
	}
	this.always(function(res) { res.pipe(target, headersCb, bodyCb); });
	return target;
};

// Event connection helper
// connects events from this stream to the target (event proxying)
Request.prototype.wireUp = function(other, async) {
	if (async) {
		var nextTick = function(fn) { return function(value) { util.nextTick(fn.bind(null, value)); }; };
		this.once('headers', nextTick(other.emit.bind(other, 'headers')));
		this.on('data', nextTick(other.emit.bind(other, 'data')));
		this.once('end', nextTick(other.emit.bind(other, 'end')));
	} else {
		this.once('headers', other.emit.bind(other, 'headers'));
		this.on('data', other.emit.bind(other, 'data'));
		this.once('end', other.emit.bind(other, 'end'));
	}
};

// starts the request transaction
Request.prototype.start = function() {
	var this2 = this;
	if (!this.isConnOpen) return this;
	if (this.isStarted) return this;
	if (!this.headers || !this.headers.url) throw "No URL on request";

	// Prep request
	if (typeof this.isVirtual == 'undefined') {
		// decide on whether this is virtual based on the presence of a hash
		this.isVirtual = (this.headers.url.indexOf('#') !== -1);
	}
    if (this.isForcedLocal && this.headers.url.charAt(0) !== '#') {
        // if local only, force
        this.headers.url = '#' + this.headers.url;
        this.isVirtual = true;
    }
    if (this.headers.url.charAt(0) == '/' && typeof window.location != 'undefined') {
		var origin = window.location.protocol + '//' + window.location.hostname + ((window.location.port) ? (':' + window.location.port) : '');
		this.headers.url = helpers.joinUri(origin, this.headers.url);
    }
	this.urld = helpers.parseUri(this.headers.url);

	// Setup response object
	var requestStartTime = Date.now();
	var ires = new IncomingResponse();
	ires.on('headers', ires.processHeaders.bind(ires, (this.isVirtual && !this.urld.authority && !this.urld.path) ? false : this.urld));
	ires.on('end', function() {
		// Track latency
		ires.latency = Date.now() - requestStartTime;
	});
	ires.on('close', function() {
		// Close the request (if its still open)
		this2.close();
	});

	var fulfill = fulfillResponsePromise.bind(null, this, ires);
	if (this.isBufferingResponse) {
		ires.buffer(fulfill);
	} else {
		ires.on('headers', fulfill);
	}
	ires.on('close', fulfill); // will have no effect if already called

	// Execute by scheme
	var scheme = (this.isVirtual) ? '#' : parseScheme(this.headers.url);
	var schemeHandler = schemes.get(scheme);
	if (schemeHandler) { schemeHandler(this, ires); }
	else {
		// invalid scheme
		var ores = new Response();
		ores.wireUp(ires);
		ores.status(0, 'unsupported scheme "'+scheme+'"').end();
	}

	this.isStarted = true;
	return this;
};

// sends data over the stream
// - emits the 'data' event
Request.prototype.write = function(data) {
	if (!this.isConnOpen) return this;
	if (!this.isStarted) this.start();
	if (this.isEnded) return this;
	this.emit('data', data);
	return this;
};

// ends the request stream
// - `data`: optional mixed, to write before ending
// - emits 'end' and 'close' events
Request.prototype.end = function(data) {
	if (!this.isConnOpen) return this;
	if (this.isEnded) return this;
	if (!this.isStarted) this.start();
	if (typeof data != 'undefined') {
		this.write(data);
	}
	this.isEnded = true;
	this.emit('end');
	// this.close();
	// ^ do not close - the response should close
	return this;
};

// closes the stream, aborting if not yet finished
// - emits 'close' event
Request.prototype.close = function() {
	if (!this.isConnOpen) return this;
	this.isConnOpen = false;
	this.emit('close');
	this.clearEvents();

	if (!this.isStarted) {
		// Fulfill with abort response
		var ires = new IncomingResponse();
		ires.on('headers', ires.processHeaders.bind(ires, (this.isVirtual && !this.urld.authority && !this.urld.path) ? false : this.urld));
		var ores = new Response();
		ores.wireUp(ires);
		ores.status(0, 'aborted by client').end();
		fulfillResponsePromise(this, ires);
	}
	return this;
};

// helper
// fulfills/reject a promise for a response with the given response
function fulfillResponsePromise(req, res) {
    if (!req.isUnfulfilled())
        return;

    // log if logging
    if (local.logTraffic) {
        console.log(req.headers, res);
    }

	// wasnt streaming, fulfill now that full response is collected
	if (res.status >= 200 && res.status < 400)
		req.fulfill(res);
	else if (res.status >= 400 && res.status < 600 || res.status === 0)
		req.reject(res);
	else
		req.fulfill(res); // :TODO: 1xx protocol handling
}

// helper - extracts scheme from the url
function parseScheme(url) {
	var schemeMatch = /^([^.^:]*):/.exec(url);
	return (schemeMatch) ? schemeMatch[1] : 'http';
}