// WebRTC Peer Server
// ==================

(function() {

	var peerConstraints = {
		optional: [{ RtpDataChannels: true }]
	};
	var mediaConstraints = {
		optional: [],
		mandatory: { OfferToReceiveAudio: false, OfferToReceiveVideo: false }
	};
	var defaultIceServers = { iceServers: [{ url: 'stun:stun.l.google.com:19302' }] };

	// RTCPeerServer
	// =============
	// EXPORTED
	// server wrapper for WebRTC connections
	// - currently only supports Chrome
	// - `config.peer`: required object, who we are connecting to (should be supplied by the peer relay)
	//   - `config.peer.stream`: required string, the peer's stream ID
	//   - `config.peer.user`: required string, the peer's user ID
	//   - `config.peer.app`: required string, the peer's app domain
	// - `config.signalStream`: required EventSource, must support the grimwire.com/-webprn/relay protocol
	// - `config.initiateAs`: optional object, if specified will initiate the connection using the object given
	//   - if given, should match the schema of `peer`
	// - `chanOpenCb`: function, called when request channel is available
	function RTCPeerServer(config, chanOpenCb) {
		var self = this;
		if (!config) config = {};
		if (!config.peer) throw new Error("`config.peer` is required");
		if (typeof config.peer.stream == 'undefined') throw new Error("`config.peer.stream` is required");
		if (typeof config.peer.user == 'undefined') throw new Error("`config.peer.user` is required");
		if (typeof config.peer.app == 'undefined') throw new Error("`config.peer.app` is required");
		if (!config.signalStream) throw new Error("`config.signalStream` is required");
		local.web.BridgeServer.call(this, config);
		this.chanOpenCb = chanOpenCb;

		// Internal state
		this.isOfferExchanged = false;
		this.isConnected = false;
		this.candidateQueue = []; // cant add candidates till we get the offer

		// Hook up to sse relay
		this.onSigRelayMessageBound = onSigRelayMessage.bind(self);
		this.config.signalStream.on('message', this.onSigRelayMessageBound);
		this.peerSignal = local.navigator(this.config.signalStream.getUrl())
			.follow({ rel: 'collection', id: 'streams' })
			.follow({ rel: 'item', id: this.config.peer.stream });

		// Create the peer connection
		var servers = defaultIceServers;
		if (config.iceServers)
			servers = config.iceServers.concat(servers); // :TODO: is concat what we want?
		this.peerConn = new webkitRTCPeerConnection(servers, peerConstraints);
		this.peerConn.onicecandidate = onIceCandidate.bind(this);

		// Create an HTTPL data channel
		this.httplChannel = this.peerConn.createDataChannel('httpl', { ordered: true, reliable: true });
		this.httplChannel.onopen    = onHttplChannelOpen.bind(this);
		this.httplChannel.onclose   = onHttplChannelClose.bind(this);
		this.httplChannel.onerror   = onHttplChannelError.bind(this);
		this.httplChannel.onmessage = onHttplChannelMessage.bind(this);

		if (this.config.initiateAs) {
			// Initiate event will be picked up by the peer
			// If they want to connect, they'll create an RTCPeerServer and send the 'ready' signal
			this.signal('initiate', this.config.initiateAs);
		} else {
			// Tell the initiator that we're ready to connect
			this.signal('ready');
		}
	}
	RTCPeerServer.prototype = Object.create(local.web.BridgeServer.prototype);
	local.web.RTCPeerServer = RTCPeerServer;

	// :DEBUG:
	RTCPeerServer.prototype.debugLog = function() {
		var args = [this.config.domain].concat([].slice.call(arguments));
		console.debug.apply(console, args);
	};

	RTCPeerServer.prototype.terminate = function() {
		this.signal('closed');
		this.isConnected = false;

		if (this.config.signalStream) {
			this.config.signalStream.removeListener('message', this.onSigRelayMessageBound);
			this.config.signalStream = null;
		}
		if (this.peerConn) {
			this.peerConn.close();
			this.peerConn = null;
		}
	};

	// Returns true if the channel is ready for activity
	// - returns boolean
	RTCPeerServer.prototype.isChannelActive = function() {
		return this.isConnected;
	};

	// Sends a single message across the channel
	// - `msg`: required string
	RTCPeerServer.prototype.channelSendMsg = function(msg) {
		this.httplChannel.send(msg);
	};

	// Remote request handler
	RTCPeerServer.prototype.handleRemoteWebRequest = function(request, response) {
		response.writeHead(500, 'not implemented');
		response.end();
	};

	// HTTPL channel event handlers
	// -

	function onHttplChannelMessage(msg) {
		this.debugLog('HTTPL CHANNEL MSG', msg);
		this.onChannelMessage(msg.data);
	}

	function onHttplChannelOpen(e) {
		this.debugLog('HTTPL CHANNEL OPEN', e);
		this.isConnected = true;
		this.flushBufferedMessages();
		if (typeof this.chanOpenCb == 'function') {
			this.chanOpenCb();
		}
	}

	function onHttplChannelClose(e) {
		this.debugLog('HTTPL CHANNEL CLOSE', e);
		this.isConnected = false;
	}

	function onHttplChannelError(e) {
		// :TODO: anything?
		this.debugLog('HTTPL CHANNEL ERR', e);
	}

	// Signal relay behaviors
	// -

	function onSigRelayMessage(m) {
		var self = this;
		var data = m.data;

		if (data && typeof data != 'object') {
			console.warn('RTCPeerServer - Unparseable signal message from signal', m);
			return;
		}

		this.debugLog('SIG', m);
		switch (m.event) {
			case 'ready':
				// If we're the initiator, get it going
				if (this.config.initiateAs) {
					sendOffer.call(this);
				}
				break;

			case 'closed':
				// Peer's dead, shut it down
				this.terminate();
				break;

			case 'candidate':
				this.debugLog('GOT CANDIDATE', data.candidate);
				// Received address info from the peer
				if (!this.isOfferExchanged) {
					this.candidateQueue.push(data.candidate);
				} else {
					this.peerConn.addIceCandidate(new RTCIceCandidate({ candidate: data.candidate }));
				}
				break;

			case 'offer':
				this.debugLog('GOT OFFER', data);
				// Received a session offer from the peer
				var desc = new RTCSessionDescription({ type: 'offer', sdp: data.sdp });
				this.peerConn.setRemoteDescription(desc);
				handleOfferExchanged.call(self);
				this.peerConn.createAnswer(
					function(desc) {
						self.debugLog('CREATED ANSWER', desc);
						desc.sdp = higherBandwidthSDP(desc.sdp);
						self.peerConn.setLocalDescription(desc);
						self.signal('answer', { sdp: desc.sdp });
					},
					null,
					mediaConstraints
				);
				break;

			case 'answer':
				this.debugLog('GOT ANSWER', data);
				// Received session confirmation from the peer
				this.peerConn.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: data.sdp }));
				handleOfferExchanged.call(self);
				break;

			default:
				console.warn('RTCPeerServer - Unrecognized signal message from signal', m);
		}
	}

	// Helper to send a message to peers on the relay
	RTCPeerServer.prototype.signal = function(event, data) {
		this.peerSignal.post({ event: event, data: data })
			.then(null, function(res) {
				console.warn('RTCPeerServer - Failed to send signal message to relay', res);
			});
	};

	// Helper initiates a session with peers on the relay
	function sendOffer() {
		var self = this;
		this.peerConn.createOffer(
			function(desc) {
				self.debugLog('CREATED OFFER', desc);
				desc.sdp = higherBandwidthSDP(desc.sdp);
				self.peerConn.setLocalDescription(desc);
				self.signal('offer', { sdp: desc.sdp });
			},
			null,
			mediaConstraints
		);
	}

	// Helper called whenever we have a remote session description
	// (candidates cant be added before then, so they're queued in case they come first)
	function handleOfferExchanged() {
		var self = this;
		this.isOfferExchanged = true;
		this.candidateQueue.forEach(function(candidate) {
			self.peerConn.addIceCandidate(new RTCIceCandidate({ candidate: candidate }));
		});
		this.candidateQueue.length = 0;
	}

	// Called by the RTCPeerConnection when we get a possible connection path
	function onIceCandidate(e) {
		if (e && e.candidate) {
			this.debugLog('FOUND ICE CANDIDATE', e.candidate);
			// send connection info to peers on the relay
			this.signal('candidate', { candidate: e.candidate.candidate });
		}
	}

	// Increases the bandwidth allocated to our connection
	// Thanks to michellebu (https://github.com/michellebu/reliable)
	var higherBandwidthSDPRE = /b\=AS\:([\d]+)/i;
	function higherBandwidthSDP(sdp) {
		return sdp.replace(higherBandwidthSDPRE, 'b=AS:102400'); // 100 Mbps
	}
})();