var util = require('../util');
var helpers = require('./helpers.js');
var httpl = require('./httpl.js');
var BridgeServer = require('./bridge-server.js');

var peerConstraints = {
	optional: [/*{RtpDataChannels: true}, */{DtlsSrtpKeyAgreement: true}]
};
var defaultIceServers = { iceServers: [{ url: 'stun:stun.l.google.com:19302' }] };

// Browser compat
var __env = (typeof window != 'undefined') ? window : ((typeof self != 'undefined') ? self : global);
var RTCSessionDescription = __env.mozRTCSessionDescription || __env.RTCSessionDescription;
var RTCPeerConnection = __env.mozRTCPeerConnection || __env.webkitRTCPeerConnection || __env.RTCPeerConnection;
var RTCIceCandidate = __env.mozRTCIceCandidate || __env.RTCIceCandidate;


// RTCBridgeServer
// ===============
// EXPORTED
// server wrapper for WebRTC connections
// - `config.peer`: required string, who we are connecting to (a valid peer domain)
// - `config.relay`: required Relay
// - `config.initiate`: optional bool, if true will initiate the connection processes
// - `config.loopback`: optional bool, is this the local host? If true, will connect to self
// - `config.retryTimeout`: optional number, time (in ms) before a connection is aborted and retried (defaults to 15000)
// - `config.retries`: optional number, number of times to retry before giving up (defaults to 3)
// - `config.log`: optional bool, enables logging of all message traffic and webrtc connection processes
function RTCBridgeServer(config) {
	// Config
	var self = this;
	if (!config) config = {};
	if (!config.peer) throw new Error("`config.peer` is required");
	if (!config.relay) throw new Error("`config.relay` is required");
	if (typeof config.retryTimeout == 'undefined') config.retryTimeout = 15000;
	if (typeof config.retries == 'undefined') config.retries = 3;
	BridgeServer.call(this, config);
	util.mixinEventEmitter(this);

	// Parse config.peer
	var peerd = helpers.parsePeerDomain(config.peer);
	if (!peerd) {
		throw new Error("Invalid peer URL: "+config.peer);
	}
	this.peerInfo = peerd;

	// Internal state
	this.isConnecting     = true;
	this.isOfferExchanged = false;
	this.isConnected      = false;
	this.isTerminated     = false;
	this.candidateQueue   = []; // cant add candidates till we get the offer
	this.offerNonce       = 0; // a random number used to decide who takes the lead if both nodes send an offer
	this.retriesLeft      = config.retries;
	this.rtcPeerConn      = null;
	this.rtcDataChannel   = null;

	// Create the peer connection
	this.createPeerConn();

	if (this.config.loopback) {
		// Setup to serve self
		this.isOfferExchanged = true;
		onHttplChannelOpen.call(this);
	} else {
		if (this.config.initiate) {
			// Initiate event will be picked up by the peer
			// If they want to connect, they'll send an answer back
			this.sendOffer();
		}
	}
}
RTCBridgeServer.prototype = Object.create(BridgeServer.prototype);
module.exports = RTCBridgeServer;

RTCBridgeServer.prototype.getPeerInfo = function() { return this.peerInfo; };
RTCBridgeServer.prototype.terminate = function(opts) {
	BridgeServer.prototype.terminate.call(this);
	this.isTerminated = true;
	if (this.isConnecting || this.isConnected) {
		if (!(opts && opts.noSignal)) {
			this.signal({ type: 'disconnect' });
		}
		this.isConnecting = false;
		this.isConnected = false;
		this.destroyPeerConn();
		this.emit('disconnected', Object.create(this.peerInfo), this);
	}
};

// Returns true if the channel is ready for activity
// - returns boolean
RTCBridgeServer.prototype.isChannelActive = function() {
	return true;// this.isConnected; - we send messages over the relay before connection
};

// Sends a single message across the channel
// - `msg`: required string
RTCBridgeServer.prototype.channelSendMsg = function(msg) {
	if (this.config.loopback) {
		this.onChannelMessage(msg);
	} else if (!this.isConnected) {
		this.signal({
			type: 'httpl',
			data: msg
		});
	} else {
		try { // :DEBUG: as soon as WebRTC stabilizes some more, let's ditch this
			this.rtcDataChannel.send(msg);

			// Can now rely on sctp ordering
			if (this.isReorderingMessages) {
				this.useMessageReordering(false);
			}
		} catch (e) {
			this.debugLog('NETWORK ERROR, BOUNCING', e);
			// Probably a NetworkError - one known cause, one party gets a dataChannel and the other doesnt
			this.signal({
				type: 'httpl',
				data: msg
			});
		}
	}
};

// Remote request handler
RTCBridgeServer.prototype.handleRemoteRequest = function(request, response) {
	var server = this.config.relay.getServer();
	if (server && typeof server == 'function') {
		server.call(this, request, response, this);
	} else if (server && server.handleRemoteRequest) {
		server.handleRemoteRequest(request, response, this);
	} else {
		response.writeHead(501, 'not implemented');
		response.end();
	}
};

// HTTPL channel event handlers
// -

function onHttplChannelMessage(msg) {
	this.debugLog('HTTPL CHANNEL MSG', msg);

	// Pass on to method in parent prototype
	this.onChannelMessage(msg.data);
}

function onHttplChannelOpen(e) {
	console.log('Successfully established WebRTC session with', this.config.peer);
	this.debugLog('HTTPL CHANNEL OPEN', e);

	// Update state
	this.isConnecting = false;
	this.isConnected = true;

	// Can now rely on sctp ordering :WRONG: it appears "open" get fired assymetrically
	// this.useMessageReordering(false);

	// Emit event
	this.emit('connected', Object.create(this.peerInfo), this);
}

function onHttplChannelClose(e) {
	console.log('Closed WebRTC session with', this.config.peer);
	this.debugLog('HTTPL CHANNEL CLOSE', e);
	this.terminate({ noSignal: true });
}

function onHttplChannelError(e) {
	this.debugLog('HTTPL CHANNEL ERR', e);
	this.emit('error', Object.create(this.peerInfo, { error: { value: e } }), this);
}

// Signal relay behaviors
// -

RTCBridgeServer.prototype.onSignal = function(msg) {
	var self = this;

	switch (msg.type) {
		case 'disconnect':
			// Peer's dead, shut it down
			this.terminate({ noSignal: true });
			break;

		case 'candidate':
			this.debugLog('GOT CANDIDATE', msg.candidate);
			// Received address info from the peer
			if (!this.isOfferExchanged) {
				// Store for when offer/answer exchange has finished
				this.candidateQueue.push(msg.candidate);
			} else {
				// Pass into the peer connection
				this.rtcPeerConn.addIceCandidate(new RTCIceCandidate({ candidate: msg.candidate }));
			}
			break;

		case 'offer':
			// Received a session offer from the peer
			this.debugLog('GOT OFFER', msg);
			if (this.isConnected) {
				this.debugLog('RECEIVED AN OFFER WHEN BELIEVED TO BE CONNECTED, DROPPING');
				return;
			}

			// Abandon ye' hope if no rtc support
			if (typeof RTCSessionDescription == 'undefined') {
				return;
			}

			// Emit event
			if (!this.isOfferExchanged) {
				this.emit('connecting', Object.create(this.peerInfo), this);
			}

			// Guard against an offer race conditions
			if (this.config.initiate) {
				// Leader conflict - compare nonces
				this.debugLog('LEADER CONFLICT DETECTED, COMPARING NONCES', 'MINE=', this.offerNonce, 'THEIRS=', msg.nonce);
				if (this.offerNonce < msg.nonce) {
					// Reset into follower role
					this.debugLog('RESETTING INTO FOLLOWER ROLE');
					this.config.initiate = false;
					this.resetPeerConn();
				}
			}

			// Watch for reset offers from the leader
			if (!this.config.initiate && this.isOfferExchanged) {
				if (this.retriesLeft > 0) {
					this.retriesLeft--;
					this.debugLog('RECEIVED A NEW OFFER, RESETTING AND RETRYING. RETRIES LEFT:', this.retriesLeft);
					this.resetPeerConn();
				} else {
					this.debugLog('RECEIVED A NEW OFFER, NO RETRIES LEFT. GIVING UP.');
					this.terminate();
					return;
				}
			}

			// Update the peer connection
			var desc = new RTCSessionDescription({ type: 'offer', sdp: msg.sdp });
			this.rtcPeerConn.setRemoteDescription(desc);

			// Burn the ICE candidate queue
			handleOfferExchanged.call(this);

			// Send an answer
			this.rtcPeerConn.createAnswer(
				function(desc) {
					self.debugLog('CREATED ANSWER', desc);

					// Store the SDP
					desc.sdp = increaseSDP_MTU(desc.sdp);
					self.rtcPeerConn.setLocalDescription(desc);

					// Send answer msg
					self.signal({ type: 'answer', sdp: desc.sdp });
				},
				function(error) {
					self.emit('error', Object.create(this.peerInfo, { error: { value: error } }), self);
				}
			);
			break;

		case 'answer':
			// Received session confirmation from the peer
			this.debugLog('GOT ANSWER', msg);

			// Update the peer connection
			this.rtcPeerConn.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: msg.sdp }));

			// Burn the ICE candidate queue
			handleOfferExchanged.call(this);
			break;

		case 'httpl':
			// Received HTTPL traffic from the peer
			this.debugLog('GOT HTTPL RELAY', msg);

			// Handle
			this.onChannelMessage(msg.data);
			break;

		default:
			console.warn('RTCBridgeServer - Unrecognized signal message from relay', msg);
	}
};

// Helper to send a message to peers on the relay
RTCBridgeServer.prototype.signal = function(msg) {
	// Send the message through our relay
	var self = this;
	var response_ = this.config.relay.signal(this.config.peer, msg);
	response_.fail(function(res) {
		if (res.status == 404 && !self.isTerminated) {
			// Peer not online, shut down for now. We can try to reconnect later
			for (var k in self.incomingStreams) {
				try {
					self.incomingStreams[k].writeHead(404, 'not found').end();
				} catch (e) {
					console.error('That weird peer 404 error', e, self.incomingStreams[k]);
				}
			}
			self.terminate({ noSignal: true });
			httpl.removeServer(self.config.domain);
		}
	});
	return response_;
};

// Helper sets up the peer connection
RTCBridgeServer.prototype.createPeerConn = function() {
	if (!this.rtcPeerConn && typeof RTCPeerConnection != 'undefined') {
		var servers = this.config.iceServers || defaultIceServers;
		this.rtcPeerConn = new RTCPeerConnection(servers, peerConstraints);
		this.rtcPeerConn.onicecandidate             = onIceCandidate.bind(this);
		this.rtcPeerConn.oniceconnectionstatechange = onIceConnectionStateChange.bind(this);
		this.rtcPeerConn.onsignalingstatechange     = onSignalingStateChange.bind(this);
		this.rtcPeerConn.ondatachannel              = onDataChannel.bind(this);

		// Reorder messages until the WebRTC session is established
		this.useMessageReordering(true);
	}
};

// Helper tears down the peer conn
RTCBridgeServer.prototype.destroyPeerConn = function(suppressEvents) {
	if (this.rtcDataChannel) {
		this.rtcDataChannel.close();
		if (suppressEvents) {
			this.rtcDataChannel.onopen    = null;
			this.rtcDataChannel.onclose   = null;
			this.rtcDataChannel.onerror   = null;
			this.rtcDataChannel.onmessage = null;
		}
		this.rtcDataChannel = null;
	}
	if (this.rtcPeerConn) {
		this.rtcPeerConn.close();
		if (suppressEvents) {
			this.rtcPeerConn.onicecandidate             = null;
			this.rtcPeerConn.oniceconnectionstatechange = null;
			this.rtcPeerConn.onsignalingstatechange     = null;
			this.rtcPeerConn.ondatachannel              = null;
		}
		this.rtcPeerConn = null;
	}
};

// Helper restarts the connection process
RTCBridgeServer.prototype.resetPeerConn = function(suppressEvents) {
	this.destroyPeerConn(true);
	this.createPeerConn();
	this.candidateQueue.length = 0;
	this.isOfferExchanged = false;
};

// Helper initiates a timeout clock for the connection process
function initConnectTimeout() {
	var self = this;
	setTimeout(function() {
		// Leader role only
		if (self.config.initiate && self.isConnected === false) {
			if (self.retriesLeft > 0) {
				self.retriesLeft--;
				self.debugLog('CONNECTION TIMED OUT, RESTARTING. TRIES LEFT:', self.retriesLeft);
				// Reset
				self.resetPeerConn();
				self.sendOffer();
			} else {
				// Give up
				console.log('Failed to establish WebRTC session with', self.config.peer, ' - Will continue bouncing traffic through the relay');
				self.debugLog('CONNECTION TIMED OUT, GIVING UP');
				self.resetPeerConn();
				// ^ resets but doesn't terminate - can try again with sendOffer()
			}
		}
	}, this.config.retryTimeout);
}

// Helper initiates a session with peers on the relay
RTCBridgeServer.prototype.sendOffer = function() {
	var self = this;
	if (typeof RTCPeerConnection == 'undefined') {
		return;
	}

	try {
		// Create the HTTPL data channel
		this.rtcDataChannel = this.rtcPeerConn.createDataChannel('httpl', { reliable: true });
		this.rtcDataChannel.onopen     = onHttplChannelOpen.bind(this);
		this.rtcDataChannel.onclose    = onHttplChannelClose.bind(this);
		this.rtcDataChannel.onerror    = onHttplChannelError.bind(this);
		this.rtcDataChannel.onmessage  = onHttplChannelMessage.bind(this);
	} catch (e) {
		// Probably a NotSupportedError - give up and let bouncing handle it
		return;
	}

	// Start the clock
	initConnectTimeout.call(this);

	// Generate offer
	this.rtcPeerConn.createOffer(
		function(desc) {
			self.debugLog('CREATED OFFER', desc);

			// Store the SDP
			desc.sdp = increaseSDP_MTU(desc.sdp);
			self.rtcPeerConn.setLocalDescription(desc);

			// Generate an offer nonce
			self.offerNonce = Math.round(Math.random() * 10000000);

			// Send offer msg
			self.signal({ type: 'offer', sdp: desc.sdp, nonce: self.offerNonce });
		},
		function(error) {
			self.emit('error', Object.create(this.peerInfo, { error: { value: error } }), self);
		}
	);
	// Emit 'connecting' on next tick
	// (next tick to make sure objects creating us get a chance to wire up the event)
	util.nextTick(function() {
		self.emit('connecting', Object.create(self.peerInfo), self);
	});
};

// Helper called whenever we have a remote session description
// (candidates cant be added before then, so they're queued in case they come first)
function handleOfferExchanged() {
	var self = this;
	this.isOfferExchanged = true;
	this.candidateQueue.forEach(function(candidate) {
		self.rtcPeerConn.addIceCandidate(new RTCIceCandidate({ candidate: candidate }));
	});
	this.candidateQueue.length = 0;
}

// Called by the RTCPeerConnection when we get a possible connection path
function onIceCandidate(e) {
	if (e && !!e.candidate) {
		this.debugLog('FOUND ICE CANDIDATE', e.candidate);
		// send connection info to peers on the relay
		this.signal({ type: 'candidate', candidate: e.candidate.candidate });
	}
}

// Called by the RTCPeerConnection on connectivity events
function onIceConnectionStateChange(e) {
	if (!!e.target && e.target.iceConnectionState === 'disconnected') {
		this.debugLog('ICE CONNECTION STATE CHANGE: DISCONNECTED', e);
		this.terminate({ noSignal: true });
	}
}

// Called by the RTCPeerConnection on connectivity events
function onSignalingStateChange(e) {
	if(e.target && e.target.signalingState == "closed"){
		this.debugLog('SIGNALING STATE CHANGE: DISCONNECTED', e);
		this.terminate({ noSignal: true });
	}
}

// Called by the RTCPeerConnection when a datachannel is created (receiving party only)
function onDataChannel(e) {
	this.debugLog('DATA CHANNEL PROVIDED', e);
	this.rtcDataChannel = e.channel;
	this.rtcDataChannel.onopen     = onHttplChannelOpen.bind(this);
	this.rtcDataChannel.onclose    = onHttplChannelClose.bind(this);
	this.rtcDataChannel.onerror    = onHttplChannelError.bind(this);
	this.rtcDataChannel.onmessage  = onHttplChannelMessage.bind(this);
}

// Increases the bandwidth allocated to our connection
// Thanks to michellebu (https://github.com/michellebu/reliable)
var higherBandwidthSDPRE = /b\=AS\:([\d]+)/i;
function increaseSDP_MTU(sdp) {
	return sdp;
	// return sdp.replace(higherBandwidthSDPRE, 'b=AS:102400'); // 100 Mbps
}