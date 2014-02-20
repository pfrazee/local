var util = require('../util');
var helpers = require('./helpers.js');
var httpl = require('./httpl.js');
var agent = require('./agent.js').agent;
var RTCBridgeServer = require('./rtc-bridge-server.js');


function randomStreamId() {
	return Math.round(Math.random()*10000);
}

// Relay
// =====
// EXPORTED
// Helper class for managing a peer web relay provider
// - `config.provider`: optional string, the relay provider
// - `config.serverFn`: optional function, the function for peerservers' handleRemoteRequest
// - `config.app`: optional string, the app to join as (defaults to window.location.host)
// - `config.sid`: optional number, the stream id (defaults to pseudo-random)
// - `config.ping`: optional number, sends a ping to self via the relay at the given interval (in ms) to keep the stream alive
//   - set to false to disable keepalive pings
//   - defaults to 45000
// - `config.retryTimeout`: optional number, time (in ms) before a peer connection is aborted and retried (defaults to 15000)
// - `config.retries`: optional number, number of times to retry a peer connection before giving up (defaults to 5)
// - `config.log`: optional bool, enables logging of all message traffic and webrtc connection processes
function Relay(config) {
	if (!config) config = {};
	if (!config.app) config.app = window.location.host;
	if (typeof config.sid == 'undefined') { config.sid = randomStreamId(); this.autoRetryStreamTaken = true; }
	if (typeof config.ping == 'undefined') { config.ping = 45000; }
	this.config = config;
	util.mixinEventEmitter(this);

	// State
	this.assignedDomain = null;
	this.connectionStatus = 0;
	Object.defineProperty(this, 'connectedToRelay', {
		get: function() { return this.connectionStatus == Relay.CONNECTED; },
		set: function(v) { this.connectionStatus = (v) ? Relay.CONNECTED : Relay.DISCONNECTED; }
	});
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
module.exports = Relay;

// Constants
Relay.DISCONNECTED = 0;
Relay.CONNECTING   = 1;
Relay.CONNECTED    = 2;

// Sets the access token and triggers a connect flow
// - `token`: required String?, the access token (null if denied access)
// - `token` should follow the form '<userId>:<'
Relay.prototype.setAccessToken = function(token) {
	if (token == "null") token = null; // this happens sometimes when a bad token gets saved in localStorage
	if (token) {
		// Extract user-id from the access token
		var tokenParts = token.split(':');
		if (tokenParts.length !== 2) {
			throw new Error('Invalid access token');
		}

		// Store
		this.userId = tokenParts[0];
		this.accessToken = token;

		if (this.relayService) {
			this.relayService.setRequestDefaults({ headers: { authorization: 'Bearer '+token }});
			this.usersCollection.setRequestDefaults({ headers: { authorization: 'Bearer '+token }});

			// Try to validate our access now
			var self = this;
			this.relayItem = this.relayService.follow({
				rel: 'gwr.io/relay',
				user: this.getUserId(),
				app: this.getApp(),
				sid: this.getSid(),
				nc: Date.now() // nocache
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
		}
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
Relay.prototype.isListening       = function() { return this.connectedToRelay; };
Relay.prototype.getAssignedDomain = function() { return this.assignedDomain; };
Relay.prototype.getAssignedUrl    = function() { return 'httpl://'+this.assignedDomain; };
Relay.prototype.getUserId         = function() { return this.userId; };
Relay.prototype.getApp            = function() { return this.config.app; };
Relay.prototype.setApp            = function(v) { this.config.app = v; };
Relay.prototype.getStreamId       = function() { return this.config.sid; };
Relay.prototype.getSid            = Relay.prototype.getStreamId;
Relay.prototype.setStreamId       = function(sid) { this.config.sid = sid; };
Relay.prototype.setSid            = Relay.prototype.setStreamId;
Relay.prototype.getAccessToken    = function() { return this.accessToken; };
Relay.prototype.getServer         = function() { return this.config.serverFn; };
Relay.prototype.setServer         = function(fn) { this.config.serverFn = fn; };
Relay.prototype.getRetryTimeout   = function() { return this.config.retryTimeout; };
Relay.prototype.setRetryTimeout   = function(v) { this.config.retryTimeout = v; };
Relay.prototype.getProvider       = function() { return this.config.provider; };
Relay.prototype.setProvider       = function(providerUrl) {
	// Abort if already connected
	if (this.connectedToRelay) {
		throw new Error("Can not change provider while connected to the relay. Call stopListening() first.");
	}
	// Update config
	this.config.provider = providerUrl;
	this.providerDomain = helpers.parseUri(providerUrl).authority;

	// Create APIs
	this.relayService = agent(this.config.provider);
	this.usersCollection = this.relayService.follow({ rel: 'gwr.io/users' });

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
			// Make sure this is from our popup
			var originUrld = helpers.parseUri(e.origin);
			var providerUrld = helpers.parseUri(this.config.provider);
			if (originUrld.authority !== providerUrld.authority) {
				return;
			}
			console.log('Received access token from '+e.origin);

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
	return api.get({ Accept: 'application/json' });
};

// Fetches a user from p2pw service
// - `userId`: string
Relay.prototype.getUser = function(userId) {
	return this.usersCollection.follow({ rel: 'gwr.io/user', id: userId }).get({ Accept: 'application/json' });
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
	if (this.relayService)
		return this.relayService.follow({ rel: 'gwr.io/relays', links: 1 });
	return agent();
};

// Subscribes to the event relay and begins handling signals
// - enables peers to connect
Relay.prototype.startListening = function() {
	var self = this;
	// Make sure we have an access token
	if (!this.getAccessToken()) {
		return;
	}
	if (this.connectionStatus !== Relay.DISCONNECTED) {
		console.error('startListening() called when already connected or connecting to relay. Must call stopListening() first.');
		return;
	}
	// Record our peer domain
	this.assignedDomain = this.makeDomain(this.getUserId(), this.config.app, this.config.sid);
	if (this.config.sid === 0) { this.assignedDomain += '!0'; } // full URI always
	// Connect to the relay stream
	this.relayItem = this.relayService.follow({
		rel: 'gwr.io/relay',
		user: this.getUserId(),
		app: this.getApp(),
		sid: this.getSid(),
		nc: Date.now() // nocache
	});
	this.connectionStatus = Relay.CONNECTING;
	this.relayItem.subscribe()
		.then(
			function(stream) {
				// Update state
				httpl.addRelay(self.providerDomain, self);
				self.relayEventStream = stream;
				self.connectionStatus = Relay.CONNECTED;
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
						self.signal(self.getAssignedDomain(), { type: 'noop' });
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
		httpl.removeRelay(this.providerDomain);
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

	// Parse the url
	peerUrl = helpers.parseUri(peerUrl).authority;
	var peerd = helpers.parsePeerDomain(peerUrl);
	if (!peerd) {
		throw new Error("Invalid peer url given to connect(): "+peerUrl);
	}

	// Make sure the url has a stream id
	if (peerd.sid === 0 && peerUrl.slice(-2) != '!0') {
		peerUrl += '!0';
	}

	// Make sure we're not already connected
	if (peerUrl in this.bridges) {
		return this.bridges[peerUrl];
	}

	// Spawn new server
	console.log('Initiating WebRTC session with', peerUrl);
	var server = new RTCBridgeServer({
		peer:         peerUrl,
		initiate:     config.initiate,
		relay:        this,
		serverFn:     this.config.serverFn,
		loopback:     (peerUrl == this.assignedDomain),
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
	this.bridges[peerUrl] = server;
	httpl.addServer(peerUrl, server);

	return server;
};

Relay.prototype.signal = function(dst, msg) {
	if (!this.relayItem) {
		console.warn('Relay - signal() called before relay is connected');
		return;
	}
	var self = this;
	var response_ = this.relayItem.dispatch({ method: 'notify', body: { src: this.assignedDomain, dst: dst, msg: msg } });
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
	var bridgeServer = this.bridges[domain] || this.bridges[domain + '!0'];

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
			this.setSid(randomStreamId());
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
		this.connectedToRelay = false;

		// Fire event
		this.emit('accessInvalid');
	} else if (e.data && (e.data.status === 0 || e.data.status == 404 || e.data.status >= 500)) { // connection lost, looks like server fault?
		// Update state
		if (this.connectedToRelay) {
			this.onRelayClose();
		}
		this.connectedToRelay = false;
		this.relayEventStream = null;

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
	this.connectedToRelay = false;
	if (self.pingInterval) { clearInterval(self.pingInterval); }

	// Fire event
	this.emit('notlistening');
};

Relay.prototype.onBridgeDisconnected = function(data) {
	// Stop tracking bridges that close
	var bridge = this.bridges[data.domain];
	if (bridge) {
		delete this.bridges[data.domain];
		httpl.removeServer(data.domain);
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
		req.send(JSON.stringify({ src: this.assignedDomain, dst: dst, msg: { type: 'disconnect' } }));
	}
};

Relay.prototype.makeDomain = function(user, app, sid) {
	return helpers.makePeerDomain(user, this.providerDomain, app, sid);
};

// :DEBUG: helper to deal with webrtc issues
if (typeof window !== 'undefined') {
	window.logWebRTC = function(v) {
		if (typeof v == 'undefined') v = true;
		var k;
		for (k in httpl.getRelays()) {
			httpl.getRelay(k).config.log = v;
		}
		for (k in httpl.getServers()) {
			var s = httpl.getServer(k);
			if (s.context && s.context instanceof RTCBridgeServer) {
				s.context.config.log = v;
			}
		}
	};
}