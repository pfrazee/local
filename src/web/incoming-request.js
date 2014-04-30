var util = require('../util');
var helpers = require('./helpers.js');
var contentTypes = require('./content-types.js');

// IncomingRequest
// ===============
// EXPORTED
// Interface for receiving requests (used in virtual servers)
function IncomingRequest(headers) {
	util.EventEmitter.call(this);
	for (var k in headers) {
		if (!this[k]) { this[k] = headers[k]; }
	}

	// Set attributes
	this.method = (this.method) ? this.method.toUpperCase() : 'GET';
	this[this.method] = true;
	this.params = (this.params) || {};
	this.isBinary = false; // stream is binary? :TODO:
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