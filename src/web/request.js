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
	this.query = options.query || {};
	this.headers = options.headers || {};
	this.stream = options.stream || false;

	this.isConnOpen = true;
	this.keepHistory('data');
	this.keepHistory('end');
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
	this.removeAllListeners('data');
	this.removeAllListeners('end');
	this.removeAllListeners('close');
};