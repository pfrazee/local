var helpers = require('./helpers.js');
var Request = require('./request.js');
var Response = require('./response.js');
var IncomingRequest = require('./incoming-request.js');
var IncomingResponse = require('./incoming-response.js');

var debugLog = true;
var envIframeExists = (typeof HTMLIFrameElement != 'undefined');
var envWorkerExists = (typeof Worker != 'undefined');
var envIsWorker     = (typeof self.window == 'undefined');

// Bridge
// ======
// EXPORTED
// wraps a reliable, ordered messaging channel to carry messages
function Bridge(path, channel, targetOrigin) {
	if (envIframeExists && channel instanceof HTMLIFrameElement) {
		channel = channel.contentWindow;
	}

	this.path = path;
	this.channel = channel;
	this.targetOrigin = targetOrigin || '*';
	this.channelIsWorker = (envWorkerExists && this.channel instanceof Worker);

	if (this.channelIsWorker) {
		channel.addEventListener('message', this.onMessage.bind(this));
	} else {
		self.addEventListener('message', this.onMessage.bind(this));
	}

	this.sidCounter = 1;
	this.incomingStreams = {}; // maps sid -> request/response stream
	// ^ only contains active streams (closed streams are deleted)
	this.outgoingStreams = {}; // like `incomingStreams`, but for requests & responses that are sending out data
	this.msgBuffer = []; // buffer of messages kept until channel is active
}
module.exports = Bridge;

// logging helper
Bridge.prototype.log = function(type) {
	var args = Array.prototype.slice.call(arguments, 1);
	args[0] = ((envIsWorker) ? '(worker) ' : '(page) ') + args[0];
	console[type].apply(console, args);
};

// Sends messages that were buffered while waiting for the channel to setup
Bridge.prototype.flushBufferedMessages = function() {
	if (debugLog) { this.log('debug', 'FLUSHING MESSAGES ' + JSON.stringify(this.msgBuffer)); }
	this.msgBuffer.forEach(function(msg) {
		this.channel.postMessage(msg, (envIsWorker || this.channelIsWorker) ? undefined : this.targetOrigin);
	}, this);
	this.msgBuffer.length = 0;
};

// Helper which buffers messages when the channel isnt ready
Bridge.prototype.send = function(msg) {
	if (this.channel.isReady === false) {
		// Buffer messages if not ready
		this.msgBuffer.push(msg);
	} else {
		if (debugLog) { this.log('debug', 'SEND ' + JSON.stringify(msg)); }
		this.channel.postMessage(msg, (envIsWorker || this.channelIsWorker) ? undefined : this.targetOrigin);
	}
};

// Closes any existing streams
Bridge.prototype.terminate = function(status, reason) {
	status = status || 503;
	reason = reason || 'Service Unavailable';
	for (var sid in this.incomingStreams) {
		var s = this.incomingStreams[sid];
		if ((s instanceof Response) && !s.headers.status) {
			s.status(status, reason);
		}
		if (s.end) { s.end(); }
		else { s.clearEvents(); }
	}
	for (sid in this.outgoingStreams) {
		var s = this.outgoingStreams[sid];
		if ((s instanceof Response) && !s.headers.status) {
			s.status(status, reason);
		}
		if (s.end) { s.end(); }
		else { s.clearEvents(); }
	}
	this.incomingStreams = {};
	this.outgoingStreams = {};
	this.msgBuffer.length = 0;
	if (this.channel.bridge) {
		this.channel.bridge = null;
	}
	this.channel = null;
};

// Virtual request handler
Bridge.prototype.onRequest = function(ireq, ores) {
	var sid = this.sidCounter++;

	// Hold onto streams
	this.outgoingStreams[sid] = ireq;
	this.incomingStreams[-sid] = ores; // store ores stream in anticipation of the response messages

	// Send headers over the channel
	var msg = {
		sid: sid,
		method: ireq.method,
		path: '#' + ((ireq.pathd[1]) ? ireq.pathd[1].slice(1) : ''),
		params: ireq.params
	};
	for (var k in ireq) {
		if (helpers.isHeaderKey(k)) {
			msg[k] = ireq[k];
		}
	}
	this.send(msg);

	// Wire up ireq stream events
	var this2 = this;
	ireq.on('data',  function(data) { this2.send({ sid: sid, body: data }); });
	ireq.on('end', function()       { this2.send({ sid: sid, end: true }); });
	ireq.on('close', function()     {
		this2.send({ sid: sid, close: true });
		delete this2.outgoingStreams[sid];
	});
};

// HTTPL implementation for incoming messages
Bridge.prototype.onMessage = function(event) {
	if (!envIsWorker && !this.channelIsWorker) {
		if (event.source != this.channel) {
			return; // not from our channel
		}
		if (this.targetOrigin != '*' && event.origin !== this.targetOrigin) {
			return console.error('Message from untrusted origin', this.targetOrigin, event);
		}
	}

	var msg = event.data;
	if (!msg) {
		return console.error('Invalid message from channel: Payload missing ' + JSON.stringify(event));
	}

	if (debugLog) { this.log('debug', 'RECV ' + JSON.stringify(msg)); }

	// Validate and parse JSON
	if (typeof msg == 'string') {
		if (!validateJson(msg)) {
			this.log('warn', 'Dropping malformed JSON message ' + JSON.stringify(msg));
			return;
		}
		msg = JSON.parse(msg);
	}
	if (!validateHttplMessage(msg)) {
		this.log('warn', 'Dropping malformed HTTPL message ' + JSON.stringify(msg));
		return;
	}

	// Get/create stream
	var stream = this.incomingStreams[msg.sid];
	if (!stream) {
		// Incoming responses have a negative sid
		if (msg.sid < 0) {
			// There should have been an incoming stream
			// (incoming response streams are created in onRequest)
			this.log('warn', 'Dropping unexpected HTTPL response message ' + JSON.stringify(msg));
			return;
		}

		// Is a new request - validate URL
		if (!msg.path) { return this.log('warn', 'Dropping HTTPL request with no path ' + JSON.stringify(msg)); }

		// Get the handler
		var httpl = require('./httpl.js');
		var handler, pathd, routes = httpl.getRoutes();
		for (var i=0; i < routes.length; i++) {
			pathd = routes[i].path.exec(msg.path);
			if (pathd) {
				handler = routes[i].handler;
				break;
			}
		}
		msg.pathd = pathd;
		if (!handler) { handler = function(req, res) { res.status(404, 'Not Found').end(); }; }

		// Create incoming request, incoming response and outgoing response
		var ireq = new IncomingRequest(msg);
		var ires = new IncomingResponse();
		var ores = new Response();
		stream = this.incomingStreams[msg.sid] = ireq;
		this.outgoingStreams[resSid] = ires;

		// Wire up events
		ores.wireUp(ires);
		ireq.memoEventsTillNextTick();
		ires.memoEventsTillNextTick();

		// Wire response into the channel
		var this2 = this;
		var resSid = -(msg.sid);
		ires.on('headers', function(headers) {
			var msg = { sid: resSid, status: headers.status, reason: headers.reason };
			for (var k in headers) { if (helpers.isHeaderKey(k)) { msg[k] = headers[k]; } }
			ires.processHeaders(false, headers);
			this2.send(msg);
		});
		ires.on('data', function(data) {
			this2.send({ sid: resSid, body: data });
		});
		ires.on('end', function() {
			this2.send({ sid: resSid, end: true });
		});
		ires.on('close', function() {
			this2.send({ sid: resSid, close: true });
			delete this2.outgoingStreams[resSid];
		});

		// Fire handler
		handler(ireq, ores, this.channel);
	}

	// Pipe received data into stream
	if (msg.sid < 0 && (stream instanceof Response)) {
		if (typeof msg.status != 'undefined') {
			stream.status(msg.status, msg.reason);
			for (var k in msg) {
				if (helpers.isHeaderKey(k)) {
					stream.header(k, msg[k]);
				}
			}
			// correct link header entries, if given, to be relative to bridge path
			if (stream.headers.Link && Array.isArray(stream.headers.Link)) {
				for (var i=0; i < stream.headers.Link.length; i++) {
					if (typeof stream.headers.Link[i].href == 'string' && stream.headers.Link[i].href.charAt(0) == '#') {
						var subpath = stream.headers.Link[i].href.slice(1);
						stream.headers.Link[i].href = this.path + ((subpath.length) ? '/' + subpath : '');
					}
				}
			}
			stream.start();
		}
		if (msg.body) { stream.write(msg.body); }
		if (msg.end) { stream.end(); }
		if (msg.close) {
			stream.close();
			delete this.incomingStreams[msg.sid];
		}
	} else if (msg.sid > 0 && (stream instanceof IncomingRequest)) {
		if (msg.body) { stream.emit('data', msg.body); }
		if (msg.end) { stream.emit('end'); }
		if (msg.close) {
			stream.emit('close');
			delete this.incomingStreams[msg.sid];
		}
	}
};

// helper used to decide if a temp worker can be ejected
Bridge.prototype.isInTransaction = function() {
	// Are we waiting on any streams?
	if (Object.keys(this.incomingStreams).length !== 0) {
		// See if any of those streams are responses
		for (var sid in this.incomingStreams) {
			if (this.incomingStreams[sid] instanceof Response && this.incomingStreams[sid].isConnOpen) {
				// not done, still receiving a response
				return true;
			}
		}
	}
	return false;
};

// This validator is faster than doing a try/catch block
// http://jsperf.com/check-json-validity-try-catch-vs-regex
function validateJson(str) {
	if (str === '') {
		return false;
	}
	str = str.replace(/\\./g, '@').replace(/"[^"\\\n\r]*"/g, '');
	return (/^[,:{}\[\]0-9.\-+Eaeflnr-u \n\r\t]*$/).test(str);
}

function validateHttplMessage(parsedmsg) {
	if (!parsedmsg)
		return false;
	if (isNaN(parsedmsg.sid))
		return false;
	return true;
}