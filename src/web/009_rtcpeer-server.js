// WebRTC Peer Server
// ==================

(function() {

	var peerConstraints = {
		// optional: [{ RtpDataChannels: true }]
		optional: [{DtlsSrtpKeyAgreement: true}]
	};
	var defaultIceServers = null;//{ iceServers: [{ url: 'stun:stun.l.google.com:19302' }] };

	function randomStreamId() {
		return Math.round(Math.random()*10000);
	}

	// RTCBridgeServer
	// ===============
	// EXPORTED
	// server wrapper for WebRTC connections
	// - currently only supports Chrome
	// - `config.peer`: required string, who we are connecting to (a valid peer domain)
	// - `config.relay`: required PeerWebRelay
	// - `config.initiate`: optional bool, if true will initiate the connection processes
	// - `config.loopback`: optional bool, is this the local host? If true, will connect to self
	function RTCBridgeServer(config) {
		// Config
		var self = this;
		if (!config) config = {};
		if (!config.peer) throw new Error("`config.peer` is required");
		if (!config.relay) throw new Error("`config.relay` is required");
		local.BridgeServer.call(this, config);
		local.util.mixinEventEmitter(this);

		// Parse config.peer
		var peerd = local.parsePeerDomain(config.peer);
		if (!peerd) {
			throw new Error("Invalid peer URL: "+config.peer);
		}
		this.peerInfo = peerd;

		// Internal state
		this.isConnecting = true;
		this.isOfferExchanged = false;
		this.isConnected = false;
		this.candidateQueue = []; // cant add candidates till we get the offer

		// Create the peer connection
		var servers = config.iceServers || defaultIceServers;
		this.rtcPeerConn = new webkitRTCPeerConnection(servers, peerConstraints);
		this.rtcPeerConn.onicecandidate             = onIceCandidate.bind(this);
		this.rtcPeerConn.onicechange                = onIceConnectionStateChange.bind(this);
		this.rtcPeerConn.oniceconnectionstatechange = onIceConnectionStateChange.bind(this);
		this.rtcPeerConn.onsignalingstatechange     = onSignalingStateChange.bind(this);

		// Create the HTTPL data channel
		this.rtcDataChannel = this.rtcPeerConn.createDataChannel('httpl', { reliable: true });
		this.rtcDataChannel.onopen     = onHttplChannelOpen.bind(this);
		this.rtcDataChannel.onclose    = onHttplChannelClose.bind(this);
		this.rtcDataChannel.onerror    = onHttplChannelError.bind(this);
		this.rtcDataChannel.onmessage  = onHttplChannelMessage.bind(this);

		if (this.config.loopback) {
			// Setup to serve self
			this.isOfferExchanged = true;
			onHttplChannelOpen.call(this);
		} else if (this.config.initiate) {
			// Initiate event will be picked up by the peer
			// If they want to connect, they'll send an answer back
			this.sendOffer();
		}
	}
	RTCBridgeServer.prototype = Object.create(local.BridgeServer.prototype);
	local.RTCBridgeServer = RTCBridgeServer;

	RTCBridgeServer.prototype.getPeerInfo = function() {
		return this.peerInfo;
	};

	// :DEBUG:
	RTCBridgeServer.prototype.debugLog = function() {
		var args = [this.config.domain].concat([].slice.call(arguments));
		console.debug.apply(console, args);
	};

	RTCBridgeServer.prototype.terminate = function(opts) {
		BridgeServer.prototype.terminate.call(this);
		if (this.isConnecting || this.isConnected) {
			if (!(opts && opts.noSignal)) {
				this.signal({ type: 'disconnect' });
			}
			this.isConnecting = false;
			this.isConnected = false;
			this.emit('disconnected', { peer: this.peerInfo, domain: this.config.domain, server: this });

			if (this.rtcPeerConn) {
				this.rtcPeerConn.close();
				this.rtcPeerConn = null;
			}
		}
	};

	// Returns true if the channel is ready for activity
	// - returns boolean
	RTCBridgeServer.prototype.isChannelActive = function() {
		return this.isConnected;
	};

	// Sends a single message across the channel
	// - `msg`: required string
	RTCBridgeServer.prototype.channelSendMsg = function(msg) {
		if (this.config.loopback) {
			this.onChannelMessage(msg);
		} else {
			this.rtcDataChannel.send(msg);
		}
	};

	// Remote request handler
	RTCBridgeServer.prototype.handleRemoteWebRequest = function(request, response) {
		if (this.config.serverFn) {
			this.config.serverFn.call(this, request, response, this);
		} else {
			response.writeHead(500, 'not implemented');
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
		this.debugLog('HTTPL CHANNEL OPEN', e);

		// Update state
		this.isConnecting = false;
		this.isConnected = true;
		this.flushBufferedMessages();

		// Emit event
		this.emit('connected', { peer: this.peerInfo, domain: this.config.domain, server: this });
	}

	function onHttplChannelClose(e) {
		this.debugLog('HTTPL CHANNEL CLOSE', e);
		this.terminate({ noSignal: true });
	}

	function onHttplChannelError(e) {
		// :TODO: anything?
		this.debugLog('HTTPL CHANNEL ERR', e);
		this.emit('error', { peer: this.peerInfo, domain: this.config.domain, server: this, err: e });
	}

	// Signal relay behaviors
	// -

	RTCBridgeServer.prototype.onSignal = function(msg) {
		var self = this;

		this.debugLog('SIG', msg);
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
				this.debugLog('GOT OFFER', msg);
				// Received a session offer from the peer
				// Emit event
				this.emit('connecting', { peer: this.peerInfo, domain: this.config.domain, server: this });
				// Update the peer connection
				var desc = new RTCSessionDescription({ type: 'offer', sdp: msg.sdp });
				this.rtcPeerConn.setRemoteDescription(desc);
				// Burn the ICE candidate queue
				handleOfferExchanged.call(self);
				// Send an answer
				this.rtcPeerConn.createAnswer(
					function(desc) {
						self.debugLog('CREATED ANSWER', desc);

						// Store the SDP
						desc.sdp = increaseSDP_MTU(desc.sdp);
						self.rtcPeerConn.setLocalDescription(desc);

						// Send answer msg
						self.signal({ type: 'answer', sdp: desc.sdp });
					}
				);
				break;

			case 'answer':
				this.debugLog('GOT ANSWER', msg);
				// Received session confirmation from the peer
				// Update the peer connection
				this.rtcPeerConn.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: msg.sdp }));
				// Burn the ICE candidate queue
				handleOfferExchanged.call(self);
				break;

			default:
				console.warn('RTCBridgeServer - Unrecognized signal message from relay', msg);
		}
	};

	// Helper to send a message to peers on the relay
	RTCBridgeServer.prototype.signal = function(msg) {
		if (!this.isConnecting || this.isConnected) {
			return;
		}
		// Send the message through our relay
		var self = this;
		this.config.relay.signal(this.config.peer, msg)
			.fail(function(res) {
				if (!self.isConnecting || self.isConnected) {
					return;
				}
				if (res.status == 404) {
					// Peer not online
					for (var k in self.incomingStreams) {
						self.incomingStreams[k].writeHead(404, 'not found').end();
					}
					self.terminate({ noSignal: true });
					local.unregisterLocal(self.config.domain);
				}
			});
	};

	// Helper initiates a session with peers on the relay
	RTCBridgeServer.prototype.sendOffer = function() {
		var self = this;
		// Generate offer
		this.rtcPeerConn.createOffer(
			function(desc) {
				self.debugLog('CREATED OFFER', desc);

				// store the SDP
				desc.sdp = increaseSDP_MTU(desc.sdp);
				self.rtcPeerConn.setLocalDescription(desc);

				// Send offer msg
				self.signal({ type: 'offer', sdp: desc.sdp });
			}
		);
		// Emit 'connecting' on next tick
		// (next tick to make sure objects creating us get a chance to wire up the event)
		setTimeout(function() {
			self.emit('connecting', { peer: self.peerInfo, domain: self.config.domain, server: self });
		}, 0);
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
		if (e && e.candidate) {
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

	// Increases the bandwidth allocated to our connection
	// Thanks to michellebu (https://github.com/michellebu/reliable)
	var higherBandwidthSDPRE = /b\=AS\:([\d]+)/i;
	function increaseSDP_MTU(sdp) {
		return sdp;
		// return sdp.replace(higherBandwidthSDPRE, 'b=AS:102400'); // 100 Mbps
	}


	// PeerWebRelay
	// ============
	// EXPORTED
	// Helper class for managing a peer web relay provider
	// - `config.provider`: optional string, the relay provider
	// - `config.serverFn`: optional function, the function for peerservers' handleRemoteWebRequest
	// - `config.app`: optional string, the app to join as (defaults to window.location.hostname)
	// - `config.stream`: optional number, the stream id (defaults to pseudo-random)
	// - `config.ping`: optional number, sends a ping to self via the relay at the given interval (in ms) to keep the stream alive
	//   - set to false to disable keepalive pings
	//   - defaults to 45000
	function PeerWebRelay(config) {
		if (!config) config = {};
		if (!config.app) config.app = window.location.hostname;
		if (typeof config.stream == 'undefined') config.stream = randomStreamId();
		if (typeof config.ping == 'undefined') { config.ping = 45000; }
		this.config = config;
		local.util.mixinEventEmitter(this);

		// State
		this.myPeerDomain = null;
		this.connectedToRelay = false;
		this.userId = null;
		this.accessToken = null;
		this.bridges = {};
		this.pingInterval = null;

		// Internal helpers
		this.messageFromAuthPopupHandler = null;

		// APIs
		this.p2pwServiceAPI = null;
		this.accessTokenAPI = null;
		this.p2pwUsersAPI = null;
		this.p2pwRelayAPI = null;
		this.relayStream = null;

		// Setup provider config
		if (config.provider) {
			this.setProvider(config.provider);
		}

		// Bind window close behavior
		window.addEventListener('beforeunload', this.onPageClose.bind(this));
	}
	local.PeerWebRelay = PeerWebRelay;

	// Sets the access token and triggers a connect flow
	// - `token`: required String?, the access token (null if denied access)
	// - `token` should follow the form '<userId>:<'
	PeerWebRelay.prototype.setAccessToken = function(token) {
		if (token) {
			// Extract user-id from the access token
			var tokenParts = token.split(':');
			if (tokenParts.length !== 2) {
				throw new Error('Invalid access token');
			}

			// Store
			this.userId = tokenParts[0];
			this.accessToken = token;
			this.p2pwServiceAPI.setRequestDefaults({ headers: { authorization: 'Bearer '+token }});
			this.p2pwUsersAPI.setRequestDefaults({ headers: { authorization: 'Bearer '+token }});

			// Try to validate our access now
			var self = this;
			this.p2pwRelayAPI = this.p2pwServiceAPI.follow({ rel: 'item grimwire.com/-p2pw/relay', id: this.getUserId(), stream: this.getStreamId(), nc: Date.now() });
			this.p2pwRelayAPI.resolve().then(
				function() {
					// Emit an event
					self.emit('accessGranted');
				},
				function(res) {
					// Handle error
					self.onRelayError({ event: 'error', data: res });
				}
			);
		} else {
			// Update state and emit event
			var hadToken = !!this.accessToken;
			this.userId = null;
			this.accessToken = null;
			if (hadToken) {
				this.emit('accessRemoved');
			}
		}
	};
	PeerWebRelay.prototype.isListening     = function() { return this.connectedToRelay; };
	PeerWebRelay.prototype.getPeerDomain   = function() { return this.myPeerDomain; };
	PeerWebRelay.prototype.getUserId       = function() { return this.userId; };
	PeerWebRelay.prototype.getApp          = function() { return this.config.app; };
	PeerWebRelay.prototype.getStreamId     = function() { return this.config.stream; };
	PeerWebRelay.prototype.setStreamId     = function(stream) { this.config.stream = stream; };
	PeerWebRelay.prototype.getAccessToken  = function() { return this.accessToken; };
	PeerWebRelay.prototype.getServerFn     = function() { return this.config.serverFn; };
	PeerWebRelay.prototype.setServerFn     = function(fn) { this.config.serverFn = fn; };
	PeerWebRelay.prototype.getProvider     = function() { return this.config.provider; };
	PeerWebRelay.prototype.setProvider     = function(providerUrl) {
		// Abort if already connected
		if (this.connectedToRelay) {
			throw new Error("Can not change provider while connected to the relay. Call stopListening() first.");
		}
		// Update config
		this.config.provider = providerUrl;
		this.providerDomain = local.parseUri(providerUrl).host;

		// Create APIs
		this.p2pwServiceAPI = local.navigator(this.config.provider);
		this.accessTokenAPI = this.p2pwServiceAPI.follow({ rel: 'grimwire.com/-access-token', app: this.config.app });
		this.p2pwUsersAPI   = this.p2pwServiceAPI.follow({ rel: 'grimwire.com/-user collection' });
		this.accessTokenAPI.resolve({ nohead: true }); // immediately resolve so requestAccessToken() can use it
	};

	// Gets an access token from the provider & user using a popup
	// - Best if called within a DOM click handler, as that will avoid popup-blocking
	//   (note, however, if the accessTokenAPI hasnt resolved its api yet, there will be an async callback that breaks that)
	// - returns promise(string), fulfills with token on success and rejects with null on failure
	PeerWebRelay.prototype.requestAccessToken = function() {
		var token_ = local.promise();

		// Start listening for messages from the popup
		if (!this.messageFromAuthPopupHandler) {
			this.messageFromAuthPopupHandler = (function(e) {
				console.debug('Message (from ' + e.origin + '): ' + e.data);

				// Make sure this is from our popup
				var originUrld = local.parseUri(e.origin);
				var providerUrld = local.parseUri(this.config.provider);
				if (originUrld.authority !== providerUrld.authority) {
					return;
				}

				// Update our token
				this.setAccessToken(e.data);

				// Stop listening
				window.removeEventListener('message', this.messageFromAuthPopupHandler);

				// If given a null, emit denial event
				if (!e.data) {
					this.emit('accessDenied');
					token_.reject(null);
				} else {
					token_.fulfill(e.data);
				}
			}).bind(this);
		}
		window.addEventListener('message', this.messageFromAuthPopupHandler);

		// Open interface in a popup
		if (this.accessTokenAPI.context.url) {
			// Try to open immediately, to avoid popup blocking
			window.open(this.accessTokenAPI.context.url);
		} else {
			// access token URI hasnt resolved yet, we have to wait for that
			this.accessTokenAPI.resolve({ nohead: true }).always(function(url) {
				window.open(url);
			});
		}

		return token_;
	};

	// Fetches users from p2pw service
	// - opts.online: optional bool, only online users
	// - opts.trusted: optional bool, only users trusted by our session
	PeerWebRelay.prototype.getUsers = function(opts) {
		var api = this.p2pwUsersAPI;
		if (opts) {
			opts.rel = 'self';
			api = api.follow(opts);
		}
		return api.get({ accept: 'application/json' });
	};

	// Subscribes to the event relay and begins handling signals
	// - enables peers to connect
	PeerWebRelay.prototype.startListening = function() {
		var self = this;
		// Make sure we have an access token
		if (!this.getAccessToken()) {
			return;
		}
		// Update "src" object, for use in signal messages
		this.myPeerDomain = this.makeDomain(this.getUserId(), this.config.app, this.config.stream);
		// Connect to the relay stream
		this.p2pwRelayAPI = this.p2pwServiceAPI.follow({ rel: 'item grimwire.com/-p2pw/relay', id: this.getUserId(), stream: this.getStreamId(), nc: Date.now() });
		this.p2pwRelayAPI.subscribe({ method: 'subscribe' })
			.then(
				function(stream) {
					// Update state
					__peer_relay_registry[self.providerDomain] = self;
					self.relayStream = stream;
					self.connectedToRelay = true;
					stream.response_.then(function(response) {
						self.emit('listening');
						return response;
					});

					// Setup handlers
					stream.on('signal', self.onSignal.bind(self));
					stream.on('error', self.onRelayError.bind(self));
					stream.on('close', self.onRelayClose.bind(self));

					// Initiate the ping interval
					if (self.pingInterval) { clearInterval(self.pingInterval); }
					if (self.config.ping) {
						self.pingInterval = setInterval(function() {
							self.signal(self.getPeerDomain(), { type: 'noop' });
						}, self.config.ping);
					}
				},
				function(err) {
					self.onRelayError({ event: 'error', data: err });
				}
			);
	};

	// Disconnects from the relay
	// - peers will no longer be able to connect
	PeerWebRelay.prototype.stopListening = function() {
		if (this.connectedToRelay) {
			// Update state
			this.connectedToRelay = false;
			this.relayStream.close();
			this.relayStream = null;
			delete __peer_relay_registry[self.providerDomain];
		}
	};

	// Spawns an RTCBridgeServer and starts the connection process with the given peer
	// - `peerUrl`: required String, the domain/url of the target peer
	// - `config.initiate`: optional Boolean, should the server initiate the connection?
	//   - defaults to true
	//   - should only be false if the connection was already initiated by the opposite end
	PeerWebRelay.prototype.connect = function(peerUrl, config) {
		if (!config) config = {};
		if (typeof config.initiate == 'undefined') config.initiate = true;

		// Make sure we're not already connected
		if (peerUrl in this.bridges) {
			return this.bridges[peerUrl];
		}

		// Parse the url
		var peerUrld = local.parseUri(peerUrl);
		var hostParts = peerUrld.host.split('!');
		var provider = hostParts[0], app = hostParts[1];
		if (!peerUrld.user || !provider || !app || !peerUrld.port) {
			throw new Error("Invalid peer url given to connect(): "+peerUrl);
		}

		// Spawn new server
		var server = new local.RTCBridgeServer({
			peer: peerUrl,
			initiate: config.initiate,
			relay: this,
			serverFn: this.config.serverFn,
			loopback: (peerUrld.authority == this.myPeerDomain)
		});

		// Bind events
		server.on('connecting', this.emit.bind(this, 'connecting'));
		server.on('connected', this.emit.bind(this, 'connected'));
		server.on('disconnected', this.onBridgeDisconnected.bind(this));
		server.on('disconnected', this.emit.bind(this, 'disconnected'));
		server.on('error', this.emit.bind(this, 'error'));

		// Add to hostmap
		this.bridges[peerUrld.authority] = server;
		local.registerLocal(peerUrld.authority, server);

		return server;
	};

	PeerWebRelay.prototype.signal = function(dst, msg) {
		if (!this.p2pwRelayAPI) {
			console.warn('PeerWebRelay - signal() called before relay is connected');
			return;
		}
		return this.p2pwRelayAPI.post({ src: this.myPeerDomain, dst: dst, msg: msg }, null, { retry: true });
	};

	PeerWebRelay.prototype.onSignal = function(e) {
		if (!e.data || !e.data.src || !e.data.msg) {
			console.warn('discarding faulty signal message', err);
		}
		if (e.data.msg.type == 'noop') { return; } // used for heartbeats to keep the stream alive

		// Find bridge that represents this origin
		var domain = e.data.src;
		var bridgeServer = this.bridges[domain];

		// Does bridge exist?
		if (bridgeServer) {
			// Let bridge handle it
			bridgeServer.onSignal(e.data.msg);
		} else {
			if (e.data.msg.type == 'offer') {
				// Create a server to handle the signal
				bridgeServer = this.connect(domain, { initiate: false });
				bridgeServer.onSignal(e.data.msg);
			}
		}
	};

	PeerWebRelay.prototype.onRelayError = function(e) {
		if (e.data && e.data.status == 423) { // locked
			// Update state
			this.relayStream = null;
			this.connectedToRelay = false;

			// Fire event
			this.emit('streamTaken');
		} else if (e.data && (e.data.status == 401 || e.data.status == 403)) { // unauthorized
			// Remove bad access token to stop reconnect attempts
			this.setAccessToken(null);
			// Fire event
			this.emit('accessInvalid');
		} else if (e.data && (e.data.status === 0 || e.data.status == 404 || e.data.status >= 500)) { // connection lost
			// Update state
			this.relayStream = null;
			this.connectedToRelay = false;

			// Attempt to reconnect in 2 seconds
			var self = this;
			setTimeout(function() {
				self.startListening();
				// Note - if this fails, an error will be rethrown and take us back here
			}, 2000);
		} else {
			// Fire event
			this.emit('error', e);
		}
	};

	PeerWebRelay.prototype.onRelayClose = function() {
		// Update state
		var wasConnected = this.connectedToRelay;
		this.connectedToRelay = false;
		if (self.pingInterval) { clearInterval(self.pingInterval); }

		// Fire event
		this.emit('notlistening');

		// Did we expect this close event?
		if (wasConnected) {
			// No, we should reconnect
			this.startListening();
		}
	};

	PeerWebRelay.prototype.onBridgeDisconnected = function(data) {
		// Stop tracking bridges that close
		var bridge = this.bridges[data.domain];
		if (bridge) {
			delete this.bridges[data.domain];
			local.unregisterLocal(data.domain);
		}
	};

	PeerWebRelay.prototype.onPageClose = function() {
		var bridgeDomains = Object.keys(this.bridges);
		if (this.connectedToRelay && bridgeDomains.length !== 0) {
			// Collect connected peer destination info
			var dst = [];
			for (var domain in this.bridges) {
				dst.push(this.bridges[domain].config.peer);
			}

			// Send a synchronous disconnect signal to all connected peers
			var req = new XMLHttpRequest();
			req.open('POST', this.p2pwRelayAPI.context.url, false);
			req.setRequestHeader('Authorization', 'Bearer '+this.accessToken);
			req.setRequestHeader('Content-type', 'application/json');
			req.send(JSON.stringify({ src: this.myPeerDomain, dst: dst, msg: { type: 'disconnect' } }));
		}
	};

	PeerWebRelay.prototype.makeDomain = function(user, app, stream) {
		return local.makePeerDomain(user, this.providerDomain, app, stream);
	};

})();