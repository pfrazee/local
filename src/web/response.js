var util = require('../util');
var promise = require('../promises.js').promise;
var helpers = require('./helpers.js');
var contentTypes = require('./content-types.js');
var httpHeaders = require('./http-headers.js');

// Response
// ========
// EXPORTED
// Interface for receiving responses
// - usually created internally and returned by `dispatch`
function Response() {
	var self = this;
	util.EventEmitter.call(this);

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

	// response buffering
	Object.defineProperty(this, 'body_', {
		value: promise(),
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
			self.body = contentTypes.deserialize(self.headers['content-type'], self.body);
		self.body_.fulfill(self.body);
	});
}
module.exports = Response;
Response.prototype = Object.create(util.EventEmitter.prototype);

Response.prototype.header = function(k, v) {
	if (typeof v != 'undefined')
		return this.setHeader(k, v);
	return this.getHeader(k);
};
Response.prototype.setHeader    = function(k, v) { this.headers[k.toLowerCase()] = v; };
Response.prototype.getHeader    = function(k) { return this.headers[k.toLowerCase()]; };
Response.prototype.removeHeader = function(k) { delete this.headers[k.toLowerCase()]; };

// EXPORTED
// calls any registered header serialization functions
// - enables apps to use objects during their operation, but remain conformant with specs during transfer
Response.prototype.serializeHeaders = function() {
	for (var k in this.headers) {
		this.headers[k] = httpHeaders.serialize(k, this.headers[k]);
	}
};

// EXPORTED
// calls any registered header deserialization functions
// - enables apps to use objects during their operation, but remain conformant with specs during transfer
Response.prototype.deserializeHeaders = function() {
	for (var k in this.headers) {
		var parsedHeader = httpHeaders.deserialize(k, this.headers[k]);
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


	// Update the link headers
	if (self.parsedHeaders.link) {
		self.parsedHeaders.link.forEach(function(link) {
			// Convert relative paths to absolute uris
			if (!helpers.isAbsUri(link.href))
				link.href = helpers.joinRelPath(request.urld, link.href);

			// Extract host data
			var host_domain = helpers.parseUri(link.href).authority;
			Object.defineProperty(link, 'host_domain', { enumerable: false, configurable: true, writable: true, value: host_domain });
			var peerd = helpers.parsePeerDomain(link.host_domain);
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
		data = contentTypes.serialize(this.headers['content-type'], data);
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