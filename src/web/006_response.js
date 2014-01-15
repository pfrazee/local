// Response
// ========
// EXPORTED
// Interface for receiving responses
// - usually created internally and returned by `dispatch`
function Response() {
	var self = this;
	local.util.EventEmitter.call(this);

	this.status = 0;
	this.reason = null;
	this.headers = {};
	this.body = '';

	// non-enumerables (dont include in response messages)
	Object.defineProperty(this, 'parsedHeaders', {
		value: {},
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
	Object.defineProperty(this, 'latency', {
		value: undefined,
		configurable: true,
		enumerable: false,
		writable: true
	});

	// header mixin
	this.on('headers', function() {
		for (var k in self.headers) {
			var k2 = titlecaseHeader(k);
			if (typeof self[k2] == 'undefined') {
				Object.defineProperty(self, k2, { value: self.headers[k], configurable: true, enumerable: false, writable: true });
			}
			var k3 = underscorifyHeader(k2);
			if (typeof self[k3] == 'undefined') {
				Object.defineProperty(self, k3, { value: self.headers[k], configurable: true, enumerable: false, writable: true });
			}
		}
	});

	// response buffering
	Object.defineProperty(this, 'body_', {
		value: local.promise(),
		configurable: true,
		enumerable: false,
		writable: false
	});
	this.on('data', function(data) {
		if (data instanceof ArrayBuffer)
			self.body = data; // browsers buffer binary responses, so dont try to stream
		else
			self.body += data;
	});
	this.on('end', function() {
		if (self.headers['content-type'])
			self.body = local.contentTypes.deserialize(self.headers['content-type'], self.body);
		self.body_.fulfill(self.body);
	});
}
local.Response = Response;
Response.prototype = Object.create(local.util.EventEmitter.prototype);

Response.prototype.setHeader    = function(k, v) { this.headers[k.toLowerCase()] = v; };
Response.prototype.getHeader    = function(k) { return this.headers[k.toLowerCase()]; };
Response.prototype.removeHeader = function(k) { delete this.headers[k.toLowerCase()]; };

// EXPORTED
// calls any registered header serialization functions
// - enables apps to use objects during their operation, but remain conformant with specs during transfer
Response.prototype.serializeHeaders = function() {
	for (var k in this.headers) {
		this.headers[k] = local.httpHeaders.serialize(k, this.headers[k]);
	}
};

// EXPORTED
// calls any registered header deserialization functions
// - enables apps to use objects during their operation, but remain conformant with specs during transfer
Response.prototype.deserializeHeaders = function() {
	for (var k in this.headers) {
		var parsedHeader = local.httpHeaders.deserialize(k, this.headers[k]);
		if (parsedHeader && typeof parsedHeader != 'string') {
			this.parsedHeaders[k] = parsedHeader;
		}
	}
};

// EXPORTED
// Makes sure response header links are absolute and extracts additional attributes
//var isUrlAbsoluteRE = /(:\/\/)|(^[-A-z0-9]*\.[-A-z0-9]*)/; // has :// or starts with ___.___
Response.prototype.processHeaders = function(request) {
	var self = this;

	// Construct the base URLd out of the via headers
	var via = self.parsedHeaders.via;
	var host_proxy = local.viaToUri(via);

	// Helper function to percent-decode the number of times necesssary
	var decodeSubURI = function(str) {
		//
		for (var i=0; i < via.length; i++)
			str = decodeURIComponent(str);
		return str;
	};

	// Update the link headers
	if (self.parsedHeaders.link) {
		self.parsedHeaders.link.forEach(function(link) {
			// Convert relative paths to absolute uris
			if (!local.isAbsUri(link.href))
				link.href = local.joinRelPath(request.urld, link.href);

			// Extract host domain
			var host_domain = null;
			if (host_proxy && link.href.indexOf(host_proxy) === 0) {
				// A suburi of the proxy? See if its an abs uri
				var suburi = decodeSubURI(link.href.slice(host_proxy.length));
				if (suburi == '/') {
					// No subpath? Must be the terminal proxy
					host_domain = via[via.length - 1].hostname;
				} else {
					suburi = suburi.slice(1); // trim preceding slash
					if (/^http(s|l)?:\/\//.test(suburi)) {
						host_domain = local.parseUri(suburi).authority;
					}
				}
			}
			if (!host_domain) {
				// Not a proxied request, handle as is
				host_domain = local.parseUri(link.href).authority;
			}

			// Set host data
			Object.defineProperty(link, 'host_domain', { enumerable: false, configurable: true, writable: true, value: host_domain });
			var peerd = local.parsePeerDomain(link.host_domain);
			if (peerd) {
				Object.defineProperty(link, 'host_user', { enumerable: false, configurable: true, writable: true, value: peerd.user });
				Object.defineProperty(link, 'host_relay', { enumerable: false, configurable: true, writable: true, value: peerd.relay });
				Object.defineProperty(link, 'host_app', { enumerable: false, configurable: true, writable: true, value: peerd.app });
				Object.defineProperty(link, 'host_sid', { enumerable: false, configurable: true, writable: true, value: peerd.sid });
			} else {
				delete link.host_user;
				delete link.host_relay;
				delete link.host_app;
				delete link.host_sid;
			}

			// Add proxy
			if (host_proxy) {
				Object.defineProperty(link, 'host_proxy', { enumerable: false, configurable: true, writable: true, value: host_proxy });
			} else {
				delete link.host_proxy;
			}
		});
	}
};

// writes the header to the response
// - emits the 'headers' event
Response.prototype.writeHead = function(status, reason, headers) {
	if (!this.isConnOpen)
		return this;
	this.status = status;
	this.reason = reason;
	if (headers) {
		for (var k in headers) {
			if (headers.hasOwnProperty(k))
				this.setHeader(k, headers[k]);
		}
	}
	this.serializeHeaders();

	this.emit('headers', this);
	return this;
};

// sends data over the stream
// - emits the 'data' event
Response.prototype.write = function(data) {
	if (!this.isConnOpen)
		return this;
	if (typeof data != 'string') {
		data = local.contentTypes.serialize(this.headers['content-type'], data);
	}
	this.emit('data', data);
	return this;
};

// ends the response stream
// - `data`: optional mixed, to write before ending
// - emits 'end' and 'close' events
Response.prototype.end = function(data) {
	if (!this.isConnOpen)
		return this;
	if (typeof data != 'undefined')
		this.write(data);
	this.emit('end');
	this.close();
	return this;
};

// closes the stream, aborting if not yet finished
// - emits 'close' event
Response.prototype.close = function() {
	if (!this.isConnOpen)
		return this;
	this.isConnOpen = false;
	this.emit('close');

	// :TODO: when events are suspended, this can cause problems
	//        maybe put these "removes" in a 'close' listener?
	// this.removeAllListeners('headers');
	// this.removeAllListeners('data');
	// this.removeAllListeners('end');
	// this.removeAllListeners('close');
	return this;
};

// internal helper
var titlecaseRegExp = /(^(.))|(\-(.))/g;
function titlecaseHeader(v) {
	return v.replace(titlecaseRegExp, function(v) { return v.toUpperCase(); });
}

// internal helper
var dashRegExp = /\-/g;
function underscorifyHeader(v) {
	return v.replace(dashRegExp, '_');
}