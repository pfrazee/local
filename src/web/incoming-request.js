var util = require('../util');
var helpers = require('./helpers.js');
var httpHeaders = require('./http-headers.js');
var contentTypes = require('./content-types.js');

// IncomingRequest
// ===============
// EXPORTED
// Interface for receiving requests (used in virtual servers)
function IncomingRequest(headers) {
	util.EventEmitter.call(this);
	var this2 = this;
	var hidden = function(k, v) { Object.defineProperty(this2, k, { value: v, writable: true }); };

	// Set attributes
	this.method = (headers.method) ? headers.method.toUpperCase() : 'GET';
	this[this.method] = true;
	this.params = (headers.params) || {};
	this.isBinary = false; // stream is binary? :TODO:
	for (var k in headers) {
		var kc = k.charAt(0);
		if (kc === kc.toUpperCase()) { // starts uppercase?
			// Is a header, save
			this[k] = headers[k];

			// Try to parse
			var parsedHeader = httpHeaders.deserialize(k, headers[k]);
			if (parsedHeader && typeof parsedHeader != 'string') {
				this[k.toLowerCase()] = parsedHeader;
			}
		}
	}

	// Stream state
	hidden('isConnOpen', true);
	hidden('isStarted', true);
	hidden('isEnded', false);
	this.on('end', function() { this2.isEnded = true; });
}
IncomingRequest.prototype = Object.create(util.EventEmitter.prototype);
module.exports = IncomingRequest;

// Stream buffering
// stores the incoming stream and attempts to parse on end
IncomingRequest.prototype.buffer = function(cb) {
	// setup buffering
	if (typeof this._buffer == 'undefined') {
		var this2 = this;
		this._buffer = '';
		this.body = null;
		this.on('data', function(data) {
			if (typeof data == 'string') {
				this2._buffer += data;
			} else {
				this2._buffer = data; // Assume it is an array buffer or some such
			}
		});
		this.on('end', function() {
			if (this2.ContentType)
				this2.body = contentTypes.deserialize(this2.ContentType, this2._buffer);
			else
				this2.body = this2._buffer;
		});
	}
	this.on('end', cb);
};

// Pipe helper
// streams the incoming request  into an outgoing request or response
// - doesnt overwrite any previously-set headers
// - params:
//   - `target`: the outgoing request or response to push data to
//   - `headersCb`: (optional) takes `(k, v)` from source and responds updated header for otarget
//   - `bodyCb`: (optional) takes `(body)` from source and responds updated body for otarget
IncomingRequest.prototype.pipe = function(target, headersCB, bodyCb) {
	headersCB = headersCB || function(v) { return v; };
	bodyCb = bodyCb || function(v) { return v; };
	if (target instanceof require('./request')) {
		if (!target.headers.method) {
			target.headers.method = this.method;
		}
		if (!target.headers.url) {
			target.headers.url = this.url;
		}
		for (var k in this) {
			if (k.charAt(0) == k.charAt(0).toUpperCase() && !(k in target.headers) && k.charAt(0) != '_') {
				target.header(k, headersCB(k, this[k]));
			}
		}
	} else if (target instanceof require('./response')) {
		if (!target.headers.ContentType && this.ContentType) {
			target.ContentType(this.ContentType);
		}
	}
	if (this.isEnded) {
		// send body (if it was buffered)
		target.end(bodyCb(this.body));
	} else {
		// wire up the stream
		this.on('data', function(chunk) { target.write(bodyCb(chunk)); });
		this.on('end', function() { target.end(); });
	}
};