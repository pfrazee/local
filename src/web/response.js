var util = require('../util');
var promise = require('../promises.js').promise;
var helpers = require('./helpers.js');
var contentTypes = require('./content-types.js');

// Response
// ========
// EXPORTED
// Interface for sending responses (used in virtual servers)
function Response() {
	util.EventEmitter.call(this);

	this.headers = {};
	this.headers.status = 0;
	this.headers.reason = '';
	this.isBinary = false; // stream is binary? :TODO:

	// Stream state
	this.isConnOpen = true;
	this.isStarted = false;
	this.isEnded = false;
}
module.exports = Response;
Response.prototype = Object.create(util.EventEmitter.prototype);

// Status & reason setter
Response.prototype.status = function(code, reason) {
	this.headers.status = code;
	this.headers.reason = reason;
	// :TODO: lookup reason if not given
	return this;
};

// Status sugars
for (var i=200; i <= 599; i++) {
	(function(i) {
		Response.prototype['s'+i] = function(reason) {
			return this.status(i, reason);
		};
	})(i);
}

// Header setter
Response.prototype.header = function(k, v) {
	k = formatHeaderKey(k);
	// Convert mime if needed
	if (k == 'ContentType') {
		v = contentTypes.lookup(v);
	}
	this.headers[k] = v;
	return this;
};

// Header sugars
[ 'Allow', 'ContentType', 'Link', 'Location', 'Pragma' ].forEach(function(k) {
	Response.prototype[k] = function(v) {
		return this.header(k, v);
	};
});

// Link-header construction helper
Response.prototype.link = function(link) {
    if (!this.headers.Link) { this.headers.Link = []; }
    if (arguments.length > 1) {
        if (Array.isArray(arguments[0])) {
            // table form
            this.link(util.table.apply(null, arguments));
        } else {
            // (href, rel, opts) form
            var href = arguments[0];
            var rel = arguments[1];
            var opts = arguments[2];
            if (rel && typeof rel == 'object') {
                opts = rel;
                rel = false;
            }
            if (!opts) opts = {};
            opts.href = href;
            if (rel) { opts.rel = (opts.rel) ? (opts.rel+' '+rel) : rel; }
            this.link(opts);
        }
    } else if (Array.isArray(link)) {
        // [{rel:,href:}...] form
        this.headers.Link = this.headers.Link.concat(link);
    } else {
        // {rel:,href:} form
        this.headers.Link.push(link);
    }
};

// helper to convert a given header value to our standard format - camel case, no dashes
var headerKeyRegex = /(^|-)(.)/g;
function formatHeaderKey(str) {
	// strip any dashes, convert to camelcase
	// eg 'foo-bar' -> 'FooBar'
	return str.replace(headerKeyRegex, function(_0,_1,_2) { return _2.toUpperCase(); });
}

// 

// Event connection helper
// connects events from this stream to the target (event proxying)
Response.prototype.wireUp = function(other, async) {
	if (async) {
		var nextTick = function(fn) { return function(value) { util.nextTick(fn.bind(null, value)); }; };
		this.once('headers', nextTick(other.emit.bind(other, 'headers')));
		this.on('data', nextTick(other.emit.bind(other, 'data')));
		this.once('end', nextTick(other.emit.bind(other, 'end')));
		this.once('close', nextTick(other.emit.bind(other, 'close')));
	} else {
		this.once('headers', other.emit.bind(other, 'headers'));
		this.on('data', other.emit.bind(other, 'data'));
		this.once('end', other.emit.bind(other, 'end'));
		this.once('close', other.emit.bind(other, 'close'));
	}
};

// writes the header to the response
// - emits the 'headers' event
Response.prototype.start = function() {
	if (!this.isConnOpen) return this;
	if (this.isEnded) return this;
	if (this.isStarted) return this;
	this.emit('headers', this.headers);
	this.isStarted = true;
	return this;
};

// sends data over the stream
// - emits the 'data' event
Response.prototype.write = function(data) {
	if (!this.isConnOpen) return this;
	if (this.isEnded) return this;
	if (!this.isStarted) this.start();
	this.emit('data', data);
	return this;
};

// ends the response stream
// - `data`: optional mixed, to write before ending
// - emits 'end' and 'close' events
Response.prototype.end = function(data) {
	if (!this.isConnOpen) return this;
	if (this.isEnded) return this;
	if (!this.isStarted) this.start();
	if (typeof data != 'undefined') {
		this.write(data);
	}
	this.isEnded = true;
	this.emit('end');
	this.close();
	return this;
};

// closes the stream, aborting if not yet finished
// - emits 'close' event
Response.prototype.close = function() {
	if (!this.isConnOpen) return this;
	this.isConnOpen = false;
	this.emit('close');
	this.clearEvents();
	return this;
};