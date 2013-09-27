// Request
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
	this.path = options.path || null;
	this.query = options.query || {};
	this.headers = options.headers || {};
	this.body = '';

	// Guess the content-type if a full body is included in the message
	if (options.body && !this.headers['content-type']) {
		this.headers['content-type'] = (typeof options.body == 'string') ? 'text/plain' : 'application/json';
	}
	// Make sure we have an accept header
	if (!this.headers['accept']) {
		this.headers['accept'] = '*/*';
	}

	// non-enumerables (dont include in request messages)
	Object.defineProperty(this, 'parsedHeaders', {
		value: {},
		configurable: true,
		enumerable: false,
		writable: true
	});
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
				self.body = local.contentTypes.deserialize(self.headers['content-type'], self.body);
			self.body_.fulfill(self.body);
		});
	})(this);
}
local.Request = Request;
Request.prototype = Object.create(local.util.EventEmitter.prototype);

Request.prototype.setHeader    = function(k, v) { this.headers[k] = v; };
Request.prototype.getHeader    = function(k) { return this.headers[k]; };
Request.prototype.removeHeader = function(k) { delete this.headers[k]; };
Request.prototype.finishStream = function() { return this.body_; };

// causes the request/response to abort after the given milliseconds
Request.prototype.setTimeout = function(ms) {
	var self = this;
	setTimeout(function() {
		if (self.isConnOpen) self.close();
	}, ms);
};

// EXPORTED
// calls any registered header serialization functions
// - enables apps to use objects during their operation, but remain conformant with specs during transfer
Request.prototype.serializeHeaders = function() {
	for (var k in this.headers) {
		this.headers[k] = local.httpHeaders.serialize(k, this.headers[k]);
	}
};

// EXPORTED
// calls any registered header deserialization functions
// - enables apps to use objects during their operation, but remain conformant with specs during transfer
Request.prototype.deserializeHeaders = function() {
	for (var k in this.headers) {
		var parsedHeader = local.httpHeaders.deserialize(k, this.headers[k]);
		if (parsedHeader && typeof parsedHeader != 'string') {
			this.parsedHeaders[k] = parsedHeader;
		}
	}
};

// sends data over the stream
// - emits the 'data' event
Request.prototype.write = function(data) {
	if (!this.isConnOpen)
		return;
	if (typeof data != 'string')
		data = local.contentTypes.serialize(this.headers['content-type'], data);
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
};