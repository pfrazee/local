// WebRTC Peer Server
// ==================

(function() {

	var peerConstraints = {
		// optional: [{ RtpDataChannels: true }]
		optional: [{DtlsSrtpKeyAgreement: true}]
	};
	var defaultIceServers = { iceServers: [{ url: 'stun:stun.l.google.com:19302' }] };

	function randomStreamId() {
		return Math.round(Math.random()*10000);
	}

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
	// - `config.relay`: required local.Relay
	// - `config.initiate`: optional bool, if true will initiate the connection processes
	// - `config.loopback`: optional bool, is this the local host? If true, will connect to self
	// - `config.retryTimeout`: optional number, time (in ms) before a connection is aborted and retried (defaults to 15000)
	// - `config.retries`: optional number, number of times to retry before giving up (defaults to 3)
	// - `config.log`: optional bool, enables logging of all message traffic
	function RTCBridgeServer(config) {
		// Config
		var self = this;
		if (!config) config = {};
		if (!config.peer) throw new Error("`config.peer` is required");
		if (!config.relay) throw new Error("`config.relay` is required");
		if (typeof config.retryTimeout == 'undefined') config.retryTimeout = 15000;
		if (typeof config.retries == 'undefined') config.retries = 3;
		local.BridgeServer.call(this, config);
		local.util.mixinEventEmitter(this);

		// Parse config.peer
		var peerd = local.parsePeerDomain(config.peer);
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
			// Reorder messages until the WebRTC session is established
			this.useMessageReordering(true);

			if (this.config.initiate) {
				// Initiate event will be picked up by the peer
				// If they want to connect, they'll send an answer back
				this.sendOffer();
			}
		}
	}
	RTCBridgeServer.prototype = Object.create(local.BridgeServer.prototype);
	local.RTCBridgeServer = RTCBridgeServer;

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
			this.rtcDataChannel.send(msg);
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

		// :HACK: canary appears to drop packets for a short period after the datachannel is made ready

		var self = this;
		setTimeout(function() {
			console.warn('using rtcDataChannel delay hack');

			// Update state
			self.isConnecting = false;
			self.isConnected = true;

			// Can now rely on sctp ordering
			self.useMessageReordering(false);

			// Emit event
			self.emit('connected', Object.create(self.peerInfo), self);
		}, 1000);
	}

	function onHttplChannelClose(e) {
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
					self.incomingStreams[k].writeHead(404, 'not found').end();
				}
				self.terminate({ noSignal: true });
				local.removeServer(self.config.domain);
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
			// this.rtcPeerConn.onicechange                = onIceConnectionStateChange.bind(this);
			this.rtcPeerConn.oniceconnectionstatechange = onIceConnectionStateChange.bind(this);
			this.rtcPeerConn.onsignalingstatechange     = onSignalingStateChange.bind(this);
			this.rtcPeerConn.ondatachannel              = onDataChannel.bind(this);
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
				// this.rtcPeerConn.onicechange                = null;
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

		// Start the clock
		initConnectTimeout.call(this);

		// Create the HTTPL data channel
		this.rtcDataChannel = this.rtcPeerConn.createDataChannel('httpl', { reliable: true });
		this.rtcDataChannel.onopen     = onHttplChannelOpen.bind(this);
		this.rtcDataChannel.onclose    = onHttplChannelClose.bind(this);
		this.rtcDataChannel.onerror    = onHttplChannelError.bind(this);
		this.rtcDataChannel.onmessage  = onHttplChannelMessage.bind(this);

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
		setTimeout(function() {
			self.emit('connecting', Object.create(self.peerInfo), self);
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


	// Relay
	// =====
	// EXPORTED
	// Helper class for managing a peer web relay provider
	// - `config.provider`: optional string, the relay provider
	// - `config.serverFn`: optional function, the function for peerservers' handleRemoteRequest
	// - `config.app`: optional string, the app to join as (defaults to window.location.host)
	// - `config.stream`: optional number, the stream id (defaults to pseudo-random)
	// - `config.ping`: optional number, sends a ping to self via the relay at the given interval (in ms) to keep the stream alive
	//   - set to false to disable keepalive pings
	//   - defaults to 45000
	// - `config.retryTimeout`: optional number, time (in ms) before a peer connection is aborted and retried (defaults to 15000)
	// - `config.retries`: optional number, number of times to retry a peer connection before giving up (defaults to 5)
	function Relay(config) {
		if (!config) config = {};
		if (!config.app) config.app = window.location.host;
		if (typeof config.stream == 'undefined') { config.stream = randomStreamId(); this.autoRetryStreamTaken = true; }
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
		this.registeredLinks = null;
		this.relayEventStream = null;

		// Internal helpers
		this.messageFromAuthPopupHandler = null;

		// Agents
		this.relayService = null;
		this.usersCollection = null;
		this.relayItem = null;

		// Setup provider config
		if (config.provider) {
			this.setProvider(config.provider);
		}

		// Bind window close behavior
		window.addEventListener('beforeunload', this.onPageClose.bind(this));
	}
	local.Relay = Relay;

	// Sets the access token and triggers a connect flow
	// - `token`: required String?, the access token (null if denied access)
	// - `token` should follow the form '<userId>:<'
	Relay.prototype.setAccessToken = function(token) {
		if (token) {
			// Extract user-id from the access token
			var tokenParts = token.split(':');
			if (tokenParts.length !== 2) {
				throw new Error('Invalid access token');
			}

			// Store
			this.userId = tokenParts[0];
			this.accessToken = token;
			this.relayService.setRequestDefaults({ headers: { authorization: 'Bearer '+token }});
			this.usersCollection.setRequestDefaults({ headers: { authorization: 'Bearer '+token }});

			// Try to validate our access now
			var self = this;
			this.relayItem = this.relayService.follow({
				rel:    'item gwr.io/relay',
				user:   this.getUserId(),
				app:    this.getApp(),
				stream: this.getStreamId(),
				nc:     Date.now() // nocache
			});
			this.relayItem.resolve().then( // a successful HEAD request will verify access
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
	Relay.prototype.isListening     = function() { return this.connectedToRelay; };
	Relay.prototype.getDomain       = function() { return this.myPeerDomain; };
	Relay.prototype.getUserId       = function() { return this.userId; };
	Relay.prototype.getApp          = function() { return this.config.app; };
	Relay.prototype.setApp          = function(v) { this.config.app = v; };
	Relay.prototype.getStreamId     = function() { return this.config.stream; };
	Relay.prototype.setStreamId     = function(stream) { this.config.stream = stream; };
	Relay.prototype.getAccessToken  = function() { return this.accessToken; };
	Relay.prototype.getServer       = function() { return this.config.serverFn; };
	Relay.prototype.setServer       = function(fn) { this.config.serverFn = fn; };
	Relay.prototype.getRetryTimeout = function() { return this.config.retryTimeout; };
	Relay.prototype.setRetryTimeout = function(v) { this.config.retryTimeout = v; };
	Relay.prototype.getProvider     = function() { return this.config.provider; };
	Relay.prototype.setProvider     = function(providerUrl) {
		// Abort if already connected
		if (this.connectedToRelay) {
			throw new Error("Can not change provider while connected to the relay. Call stopListening() first.");
		}
		// Update config
		this.config.provider = providerUrl;
		this.providerDomain = local.parseUri(providerUrl).host;

		// Create APIs
		this.relayService = local.agent(this.config.provider);
		this.usersCollection = this.relayService.follow({ rel: 'gwr.io/user collection' });

		if (this.accessToken) {
			this.relayService.setRequestDefaults({ headers: { authorization: 'Bearer '+this.accessToken }});
			this.usersCollection.setRequestDefaults({ headers: { authorization: 'Bearer '+this.accessToken }});
		}
	};

	// Gets an access token from the provider & user using a popup
	// - Best if called within a DOM click handler, as that will avoid popup-blocking
	// - `opts.guestof`: optional string, the host userid providing the guest account. If specified, attempts to get a guest session
	Relay.prototype.requestAccessToken = function(opts) {
		// Start listening for messages from the popup
		if (!this.messageFromAuthPopupHandler) {
			this.messageFromAuthPopupHandler = (function(e) {
				console.log('Received access token from '+e.origin);

				// Make sure this is from our popup
				var originUrld = local.parseUri(e.origin);
				var providerUrld = local.parseUri(this.config.provider);
				if (originUrld.authority !== providerUrld.authority) {
					return;
				}

				// Use this moment to switch to HTTPS, if we're using HTTP
				// - this occurs when the provider domain is given without a protocol, and the server is HTTPS
				// - failing to do so causes a redirect during the XHR calls to the relay, which violates a CORS condition
				if (this.config.provider != e.origin) {
					this.setProvider(e.origin);
				}

				// Update our token
				this.setAccessToken(e.data);

				// If given a null, emit denial event
				if (!e.data) {
					this.emit('accessDenied');
				}
			}).bind(this);
			window.addEventListener('message', this.messageFromAuthPopupHandler);
		}

		// Open interface in a popup
		// :HACK: because popup blocking can only be avoided by a syncronous popup call, we have to manually construct the url (it burns us)
		var url = this.getProvider() + '/session/' + this.config.app;
		if (opts && opts.guestof) { url += '?guestof='+encodeURIComponent(opts.guestof); }
		window.open(url);
	};

	// Fetches users from p2pw service
	// - opts.online: optional bool, only online users
	// - opts.trusted: optional bool, only users trusted by our session
	Relay.prototype.getUsers = function(opts) {
		var api = this.usersCollection;
		if (opts) {
			opts.rel = 'self';
			api = api.follow(opts);
		}
		return api.get({ accept: 'application/json' });
	};

	// Fetches a user from p2pw service
	// - `userId`: string
	Relay.prototype.getUser = function(userId) {
		return this.usersCollection.follow({ rel: 'item gwr.io/user', id: userId }).get({ accept: 'application/json' });
	};

	// Sends (or stores to send) links in the relay's registry
	Relay.prototype.registerLinks = function(links) {
		this.registeredLinks = Array.isArray(links) ? links : [links];
		if (this.relayItem) {
			this.relayItem.dispatch({ method: 'PATCH', body: { links: this.registeredLinks }});
		}
	};

	// Creates a new agent with up-to-date links for the relay
	Relay.prototype.agent = function() {
		return this.relayService.follow({ rel: 'collection gwr.io/relay', links: 1 });
	};

	// Subscribes to the event relay and begins handling signals
	// - enables peers to connect
	Relay.prototype.startListening = function() {
		var self = this;
		// Make sure we have an access token
		if (!this.getAccessToken()) {
			return;
		}
		// Update "src" object, for use in signal messages
		this.myPeerDomain = this.makeDomain(this.getUserId(), this.config.app, this.config.stream);
		// Connect to the relay stream
		this.relayItem = this.relayService.follow({
			rel:    'item gwr.io/relay',
			user:   this.getUserId(),
			app:    this.getApp(),
			stream: this.getStreamId(),
			nc:     Date.now() // nocache
		});
		this.relayItem.subscribe()
			.then(
				function(stream) {
					// Update state
					__peer_relay_registry[self.providerDomain] = self;
					self.relayEventStream = stream;
					self.connectedToRelay = true;
					stream.response_.then(function(response) {
						// Setup links
						if (self.registeredLinks) {
							// We had links stored from before, send them now
							self.registerLinks(self.registeredLinks);
						}

						// Emit event
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
							self.signal(self.getDomain(), { type: 'noop' });
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
	Relay.prototype.stopListening = function() {
		if (this.connectedToRelay) {
			// Terminate any bridges that are mid-connection
			for (var domain in this.bridges) {
				if (this.bridges[domain].isConnecting) {
					this.bridges[domain].terminate();
				}
			}

			// Update state
			this.connectedToRelay = false;
			this.relayEventStream.close();
			this.relayEventStream = null;
			delete __peer_relay_registry[this.providerDomain];
		}
	};

	// Spawns an RTCBridgeServer and starts the connection process with the given peer
	// - `peerUrl`: required String, the domain/url of the target peer
	// - `config.initiate`: optional Boolean, should the server initiate the connection?
	//   - defaults to true
	//   - should only be false if the connection was already initiated by the opposite end
	// - `config.retryTimeout`: optional number, time (in ms) before a connection is aborted and retried (defaults to 15000)
	// - `config.retries`: optional number, number of times to retry before giving up (defaults to 5)
	Relay.prototype.connect = function(peerUrl, config) {
		if (!config) config = {};
		if (typeof config.initiate == 'undefined') config.initiate = true;

		// Make sure we're not already connected
		if (peerUrl in this.bridges) {
			return this.bridges[peerUrl];
		}

		// Parse the url
		var peerUrld = local.parseUri(peerUrl);
		var peerd = local.parsePeerDomain(peerUrld.authority);
		if (!peerd) {
			throw new Error("Invalid peer url given to connect(): "+peerUrl);
		}

		// Spawn new server
		var server = new local.RTCBridgeServer({
			peer:         peerUrl,
			initiate:     config.initiate,
			relay:        this,
			serverFn:     this.config.serverFn,
			loopback:     (peerUrld.authority == this.myPeerDomain),
			retryTimeout: config.retryTimeout || this.config.retryTimeout,
			retries:      config.retries || this.config.retries,
			log:          this.config.log || false
		});

		// Bind events
		server.on('connecting', this.emit.bind(this, 'connecting'));
		server.on('connected', this.emit.bind(this, 'connected'));
		server.on('disconnected', this.onBridgeDisconnected.bind(this));
		server.on('disconnected', this.emit.bind(this, 'disconnected'));
		server.on('error', this.emit.bind(this, 'error'));

		// Add to hostmap
		this.bridges[peerUrld.authority] = server;
		local.addServer(peerUrld.authority, server);

		return server;
	};

	Relay.prototype.signal = function(dst, msg) {
		if (!this.relayItem) {
			console.warn('Relay - signal() called before relay is connected');
			return;
		}
		var self = this;
		var response_ = this.relayItem.dispatch({ method: 'notify', body: { src: this.myPeerDomain, dst: dst, msg: msg } });
		response_.fail(function(res) {
			if (res.status == 401) {
				if (!self.accessToken) {
					return;
				}
				// Remove bad access token to stop reconnect attempts
				self.setAccessToken(null);
				// Fire event
				self.emit('accessInvalid');
			}
		});
		return response_;
	};

	Relay.prototype.onSignal = function(e) {
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
			if (e.data.msg.type == 'offer' || e.data.msg.type == 'httpl') {
				// Create a server to handle the signal
				bridgeServer = this.connect(domain, { initiate: false });
				bridgeServer.onSignal(e.data.msg);
			}
		}
	};

	Relay.prototype.onRelayError = function(e) {
		if (e.data && e.data.status == 423) { // locked
			// Update state
			this.relayEventStream = null;
			this.connectedToRelay = false;

			if (!this.autoRetryStreamTaken) {
				// Fire event
				this.emit('streamTaken');
			} else {
				// Auto-retry
				this.setStreamId(randomStreamId());
				this.startListening();
			}
		} else if (e.data && e.data.status == 420) { // out of streams
			// Update state
			this.relayEventStream = null;
			this.connectedToRelay = false;

			// Fire event
			this.emit('outOfStreams');
		} else if (e.data && (e.data.status == 401 || e.data.status == 403)) { // unauthorized
			// Remove bad access token to stop reconnect attempts
			this.setAccessToken(null);
			// Fire event
			this.emit('accessInvalid');
		} else if (e.data && (e.data.status === 0 || e.data.status == 404 || e.data.status >= 500)) { // connection lost
			// Update state
			this.relayEventStream = null;
			this.connectedToRelay = false;

			// Attempt to reconnect in 2 seconds
			var self = this;
			setTimeout(function() {
				self.startListening();
				// Note - if this fails, an error will be rethrown and take us back here
			}, 2000);
		} else {
			// Fire event
			this.emit('error', { error: e.data });
		}
	};

	Relay.prototype.onRelayClose = function() {
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

	Relay.prototype.onBridgeDisconnected = function(data) {
		// Stop tracking bridges that close
		var bridge = this.bridges[data.domain];
		if (bridge) {
			delete this.bridges[data.domain];
			local.removeServer(data.domain);
		}
	};

	Relay.prototype.onPageClose = function() {
		var bridgeDomains = Object.keys(this.bridges);
		if (this.connectedToRelay && bridgeDomains.length !== 0) {
			// Collect connected peer destination info
			var dst = [];
			for (var domain in this.bridges) {
				dst.push(this.bridges[domain].config.peer);
			}

			// Send a synchronous disconnect signal to all connected peers
			var req = new XMLHttpRequest();
			req.open('NOTIFY', this.relayItem.context.url, false);
			req.setRequestHeader('Authorization', 'Bearer '+this.accessToken);
			req.setRequestHeader('Content-type', 'application/json');
			req.send(JSON.stringify({ src: this.myPeerDomain, dst: dst, msg: { type: 'disconnect' } }));
		}
	};

	Relay.prototype.makeDomain = function(user, app, stream) {
		return local.makePeerDomain(user, this.providerDomain, app, stream);
	};

})();