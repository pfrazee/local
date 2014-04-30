var util = require('../util');
var helpers = require('./helpers.js');
var httpHeaders = require('./http-headers.js');
var contentTypes = require('./content-types.js');

// IncomingResponse
// ================
// EXPORTED
// Interface for receiving responses
function IncomingResponse() {
	util.EventEmitter.call(this);
	var this2 = this;
	var hidden = function(k, v) { Object.defineProperty(this2, k, { value: v, writable: true }); };

	// Set attributes
	this.status = 0;
	this.reason = undefined;
	hidden('latency', undefined);

	// Stream state
	hidden('isConnOpen', true);
	hidden('isStarted', true);
	hidden('isEnded', false);
	this.on('end', function() { this2.isEnded = true; });
}
IncomingResponse.prototype = Object.create(util.EventEmitter.prototype);
module.exports = IncomingResponse;

// Parses headers, makes sure response header links are absolute
IncomingResponse.prototype.processHeaders = function(oreq, headers) {
	this.status = headers.status;
	this.reason = headers.reason;

	// Parse headers
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

	// Update the link headers
	if (this.link) {
		this.links = this.link;
		delete this.link;
		this.links.forEach(function(link) {
			// Convert relative paths to absolute uris
			if (!helpers.isAbsUri(link.href)) {
				if (oreq.isVirtual) {
					link.href = '#'+link.href;
				} else {
					link.href = helpers.joinRelPath(oreq.urld, link.href);
				}
			}
		});
	}
};

// Stream buffering
// stores the incoming stream and attempts to parse on end
IncomingResponse.prototype.buffer = function(cb) {
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
// streams the incoming resposne into an outgoing request or response
// - doesnt overwrite any previously-set headers
// - params:
//   - `target`: the incoming request or response to pull data from
//   - `headersCb`: (optional) takes `(k, v)` from source and responds updated header for target
//   - `bodyCb`: (optional) takes `(body)` from source and responds updated body for target
IncomingResponse.prototype.pipe = function(target, headersCB, bodyCb) {
	headersCB = headersCB || function(v) { return v; };
	bodyCb = bodyCb || function(v) { return v; };
	if (target instanceof require('./response')) {
		if (!target.headers.status) {
			target.status(this.status, this.reason);
		}
		for (var k in this) {
			if (k.charAt(0) == k.charAt(0).toUpperCase() && !(k in target.headers) && k.charAt(0) != '_') {
				target.header(k, headersCB(k, this[k]));
			}
		}
	} else if (target instanceof require('./request')) {
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