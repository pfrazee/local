var Request = require('./request.js');
var Response = require('./response.js');
var Server = require('./server.js');
var contentTypes = require('./content-types.js');

// BridgeServer
// ============
// EXPORTED
// Core type for all servers which pipe requests between separated namespaces (eg WorkerBridgeServer, RTCBridgeServer)
// - Should be used as a prototype
// - Provides HTTPL implementation using the channel methods (which should be overridden by the subclasses)
// - Underlying channel must be:
//   - reliable
//   - order-guaranteed
// - Underlying channel is assumed not to be:
//   - multiplexed
// - :NOTE: WebRTC's SCTP should eventually support multiplexing, in which case RTCBridgeServer should
//   abstract multiple streams into the one "channel" to prevent head-of-line blocking
function BridgeServer(config) {
	Server.call(this, config);

	this.sidCounter = 1;
	this.incomingStreams = {}; // maps sid -> request/response stream
	// ^ only contains active streams (closed streams are deleted)
	this.incomingStreamsBuffer = {}; // maps sid -> {nextMid:, cache:{}}
	this.outgoingStreams = {}; // like `incomingStreams`, but for requests & responses that are sending out data
	this.msgBuffer = []; // buffer of messages kept until channel is active
	this.isReorderingMessages = false;
}
BridgeServer.prototype = Object.create(Server.prototype);
module.exports = BridgeServer;

// Turns on/off message numbering and the HOL-blocking reorder protocol
BridgeServer.prototype.useMessageReordering = function(v) {
	this.debugLog('turning '+(v?'on':'off')+' reordering');
	this.isReorderingMessages = !!v;
};

// Returns true if the channel is ready for activity
// - should be overridden
// - returns boolean
BridgeServer.prototype.isChannelActive = function() {
	console.warn('isChannelActive not defined', this);
	return false;
};

// Sends a single message across the channel
// - should be overridden
// - `msg`: required string
BridgeServer.prototype.channelSendMsg = function(msg) {
	console.warn('channelSendMsg not defined', this, msg);
};

// Remote request handler
// - should be overridden
BridgeServer.prototype.handleRemoteRequest = function(request, response) {
	console.warn('handleRemoteRequest not defined', this);
	response.writeHead(501, 'server not implemented');
	response.end();
};

// Sends messages that were buffered while waiting for the channel to setup
// - should be called by the subclass if there's any period between creation and channel activation
BridgeServer.prototype.flushBufferedMessages = function() {
	this.debugLog('FLUSHING MESSAGES', this, JSON.stringify(this.msgBuffer));
	this.msgBuffer.forEach(function(msg) {
		this.channelSendMsg(msg);
	}, this);
	this.msgBuffer.length = 0;
};

// Helper which buffers messages when the channel isnt active
BridgeServer.prototype.channelSendMsgWhenReady = function(msg) {
	if (!this.isChannelActive()) {
		// Buffer messages if not ready
		this.msgBuffer.push(msg);
	} else {
		this.channelSendMsg(msg);
	}
};

// Local request handler
// - pipes the request directly to the remote namespace
BridgeServer.prototype.handleLocalRequest = function(request, response) {
	// Build message
	var sid = this.sidCounter++;
	var query_part = contentTypes.serialize('application/x-www-form-urlencoded', request.query);
	var msg = {
		sid: sid,
		mid: (this.isReorderingMessages) ? 1 : undefined,
		method: request.method,
		path: request.path + ((query_part) ? ('?'+query_part) : ''),
		headers: request.headers
	};

	// Hold onto streams
	this.outgoingStreams[msg.sid] = request;
	this.incomingStreams[-msg.sid] = response; // store response stream in anticipation of the response messages

	// Send over the channel
	this.channelSendMsgWhenReady(JSON.stringify(msg));

	// Wire up request stream events
	var this2 = this;
	var midCounter = msg.mid;
	request.on('data',  function(data) { this2.channelSendMsgWhenReady(JSON.stringify({ sid: sid, mid: (midCounter) ? ++midCounter : undefined, body: data })); });
	request.on('end', function()       { this2.channelSendMsgWhenReady(JSON.stringify({ sid: sid, mid: (midCounter) ? ++midCounter : undefined, end: true })); });
	request.on('close', function()     {
		this2.channelSendMsgWhenReady(JSON.stringify({ sid: sid, mid: (midCounter) ? ++midCounter : undefined, close: true }));
		delete this2.outgoingStreams[msg.sid];
	});
};

// Called before server destruction
// - may be overridden
// - executes syncronously; does not wait for cleanup to finish
BridgeServer.prototype.terminate = function() {
	Server.prototype.terminate.call(this);
	for (var sid in this.incomingStreams) {
		this.incomingStreams[sid].end();
	}
	for (sid in this.outgoingStreams) {
		this.outgoingStreams[sid].end();
	}
	this.incomingStreams = this.outgoingStreams = {};
};

// HTTPL implementation for incoming messages
// - should be called by subclasses on incoming messages
BridgeServer.prototype.onChannelMessage = function(msg) {
	// Validate and parse JSON
	if (typeof msg == 'string') {
		if (!validateJson(msg)) {
			console.warn('Dropping malformed HTTPL message', msg, this);
			return;
		}
		msg = JSON.parse(msg);
	}
	if (!validateHttplMessage(msg)) {
		console.warn('Dropping malformed HTTPL message', msg, this);
		return;
	}

	// Do input buffering if the message is numbered
	if (msg.mid) {
		// Create the buffer
		if (!this.incomingStreamsBuffer[msg.sid]) {
			this.incomingStreamsBuffer[msg.sid] = {
				nextMid: 1,
				cache: {}
			};
		}
		// Cache (block at HOL) if not next in line
		if (this.incomingStreamsBuffer[msg.sid].nextMid != msg.mid) {
			this.incomingStreamsBuffer[msg.sid].cache[msg.mid] = msg;
			return;
		}
	}

	// Get/create stream
	var stream = this.incomingStreams[msg.sid];
	if (!stream) {
		// Incoming requests have a positive sid
		if (msg.sid > 0) {
			// Extracy query
			var query = null;
			var pathparts = (msg.path||'').split('?');
			msg.path = pathparts[0];
			if (pathparts[1]) {
				query = contentTypes.deserialize('application/x-www-form-urlencoded', pathparts[1]);
			}

			// Create request & response
			var request = new Request({
				method: msg.method,
				path: msg.path,
				query: query,
				headers: msg.headers
			});
			request.deserializeHeaders();
			var response = new Response();
			request.on('close', function() { response.close(); });

			// Wire response into the stream
			var this2 = this;
			var resSid = -(msg.sid);
			var midCounter = (this.isReorderingMessages) ? 1 : undefined;
			response.on('headers', function() {
				this2.channelSendMsg(JSON.stringify({
					sid: resSid,
					mid: (midCounter) ? midCounter++ : undefined,
					status: response.status,
					reason: response.reason,
					headers: response.headers,
				}));
			});
			response.on('data',  function(data) {
				this2.channelSendMsg(JSON.stringify({ sid: resSid, mid: (midCounter) ? midCounter++ : undefined, body: data }));
			});
			response.on('end', function() {
				this2.channelSendMsg(JSON.stringify({ sid: resSid, mid: (midCounter) ? midCounter++ : undefined, end: true }));
			});
			response.on('close', function() {
				this2.channelSendMsg(JSON.stringify({ sid: resSid, mid: (midCounter) ? midCounter++ : undefined, close: true }));
				delete this2.outgoingStreams[resSid];
			});

			// Hold onto the streams
			stream = this.incomingStreams[msg.sid] = request;
			this.outgoingStreams[resSid] = response;

			// Pass on to the request handler
			this.handleRemoteRequest(request, response);
		}
		// Incoming responses have a negative sid
		else {
			// There should have been an incoming stream
			// (incoming response streams are created locally on remote request dispatches)
			console.warn('Dropping unexpected HTTPL response message', msg, this);
			return;
		}
	}

	// {status: [int]} -> write head
	if (msg.sid < 0 && typeof msg.status != 'undefined') {
		stream.writeHead(msg.status, msg.reason, msg.headers);
	}

	// {body: [String]} -> write to stream body
	if (msg.body) {
		stream.write(msg.body);
	}

	// {end: true} -> end stream
	if (msg.end) {
		stream.end();
	}

	// {close: true} -> close stream
	if (msg.close) {
		stream.close();
		delete this.incomingStreams[msg.sid];
		delete this.incomingStreamsBuffer[msg.sid];
		return;
	}

	// Check the cache if the message is numbered for reordering
	if (msg.mid) {
		// Is the next message cached?
		var nextmid = ++this.incomingStreamsBuffer[msg.sid].nextMid;
		if (this.incomingStreamsBuffer[msg.sid].cache[nextmid]) {
			// Process it now
			var cachedmsg = this.incomingStreamsBuffer[msg.sid].cache[nextmid];
			delete this.incomingStreamsBuffer[msg.sid].cache[nextmid];
			this.onChannelMessage(cachedmsg);
		}
	}
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