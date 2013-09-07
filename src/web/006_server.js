// Server
// ======
// EXPORTED
// core type for all servers
// - should be used as a prototype
function Server(config) {
	this.config = { domain: null };
	if (config) {
		for (var k in config)
			this.config[k] = config[k];
	}
}
local.web.Server = Server;

Server.prototype.getUrl = function() {
	return 'httpl://' + this.config.domain;
};

// Local request handler
// - should be overridden
Server.prototype.handleLocalWebRequest = function(request, response) {
	console.warn('handleLocalWebRequest not defined', this);
	response.writeHead(500, 'server not implemented');
	response.end();
};

// Called before server destruction
// - may be overridden
// - executes syncronously; does not wait for cleanup to finish
Server.prototype.terminate = function() {
};


// BridgeServer
// ============
// EXPORTED
// Core type for all servers which pipe requests between separated namespaces (eg WorkerServer, RTCPeerServer)
// - Should be used as a prototype
// - Provides HTTPL implementation using the channel methods (which should be overridden by the subclasses)
// - Underlying channel must be:
//   - reliable
//   - order-guaranteed
// - Underlying channel is assumed not to be:
//   - multiplexed
// - :NOTE: WebRTC's SCTP should eventually support multiplexing, in which case RTCPeerServer should
//   abstract multiple streams into the one "channel" to prevent head-of-line blocking
function BridgeServer(config) {
	Server.call(this, config);

	this.sidCounter = 1;
	this.incomingStreams = {}; // maps sid -> request/response stream
	// ^ only contains active streams (closed streams are deleted)
	this.msgBuffer = []; // buffer of messages kept until channel is active
}
BridgeServer.prototype = Object.create(Server.prototype);
local.web.BridgeServer = BridgeServer;

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
BridgeServer.prototype.handleRemoteWebRequest = function(request, response) {
	console.warn('handleRemoteWebRequest not defined', this);
	response.writeHead(500, 'server not implemented');
	response.end();
};

// Sends messages that were buffered while waiting for the channel to setup
// - should be called by the subclass if there's any period between creation and channel activation
BridgeServer.prototype.flushBufferedMessages = function() {
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
BridgeServer.prototype.handleLocalWebRequest = function(request, response) {
	// Build message
	var sid = this.sidCounter++;
	var msg = {
		sid: sid,
		method: request.method,
		path: request.path,
		headers: request.headers
	};

	// Store response stream in anticipation of the response messages
	this.incomingStreams[-msg.sid] = response;

	// Send over the channel
	this.channelSendMsgWhenReady(JSON.stringify(msg));
	if (!msg.end) {
		// Wire up request stream events
		var this2 = this;
		request.on('data',  function(data) { this2.channelSendMsgWhenReady(JSON.stringify({ sid: sid, body: data })); });
		request.on('end', function()       { this2.channelSendMsgWhenReady(JSON.stringify({ sid: sid, end: true })); });
	}
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

	// Get/create stream
	var stream = this.incomingStreams[msg.sid];
	if (!stream) {
		// Incoming requests have a positive sid
		if (msg.sid > 0) {
			// Create request & response
			var request = new local.web.Request({
				method: msg.method,
				path: msg.path,
				headers: msg.headers
			});
			var response = new local.web.Response();

			// Wire response into the stream
			var this2 = this;
			var resSid = -(msg.sid);
			response.on('headers', function() {
				this2.channelSendMsg(JSON.stringify({
					sid: resSid,
					status: response.status,
					reason: response.reason,
					headers: response.headers
				}));
			});
			response.on('data',  function(data) { this2.channelSendMsg(JSON.stringify({ sid: resSid, body: data })); });
			response.on('close', function()     { this2.channelSendMsg(JSON.stringify({ sid: resSid, end: true })); });

			// Pass on to the request handler
			this.handleRemoteWebRequest(request, response);

			// Hold onto the stream
			stream = this.incomingStreams[msg.sid] = request;
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

	// {end: true} -> close stream
	if (msg.end) {
		stream.end();
		stream.close();
		delete this.incomingStreams[msg.sid];
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