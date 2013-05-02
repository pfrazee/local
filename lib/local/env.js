// Local Environment
// =================
// pfraze 2013

if (typeof this.local == 'undefined')
	this.local = {};
if (typeof this.local.env == 'undefined')
	this.local.env = {};

(function() {// Env Worker
// ==========

(function () {
	var __cur_mid = 1;
	function gen_mid() { return __cur_mid++; }

	// Worker
	// ======
	// EXPORTED
	// wraps a Web Worker API tools for sandboxing and messaging
	// - should be used by the environment hosting the workers (most likely the document)
	// - loads the worker with the bootstrap script
	// - `options.bootstrapUrl` may optionally specify the URL of the worker bootstrap script
	// - `options.log` will enable logging of traffic
	function LocalEnvWorker(readyCb, options) {
		options = options || {};
		this.isLogging = options.log;

		this.messageListeners = {};
		this.replyCbs = {};
		this.messageBuffers = {};

		if (readyCb)
			this.onNamedMessage('ready', readyCb, this);

		this.worker = new Worker(options.bootstrapUrl || 'worker.js');
		setupMessagingHandlers.call(this);
	}
	local.env.Worker = LocalEnvWorker;

	// INTERNAL
	// registers listeners required for messaging
	function setupMessagingHandlers() {
		var self = this;
		this.worker.addEventListener('message', function(event) {
			var message = event.data;
			if (this.isLogging) { console.log('receiving', message); }

			// handle replies
			if (message.name === 'reply') {
				var cb = self.replyCbs[message.reply_to];
				if (cb) {
					cb.func.call(cb.context, message);
					delete self.replyCbs[message.reply_to]; // wont need to call again
					return;
				}
			}

			var listeners = self.messageListeners[message.name];

			// streaming
			if (message.name === 'endMessage') {
				var mid = message.data;
				listeners = self.messageListeners[mid]; // inform message listeners
				self.removeAllNamedMessageListeners(mid); // and release their references
			}

			// dispatch
			if (listeners) {
				listeners.forEach(function(listener) {
					listener.func.call(listener.context, message);
				});
			}
		});
	}

	// EXPORTED
	// sends a message to the LocalEnvWorker
	// - `messageName` is required
	// - returns id of the new message
	// - if `replyCb` is specified, it will be called once if/when the LocalEnvWorker sends a reply to the message
	// - to send more data afterwards (streaming) use the returned id as the message name
	LocalEnvWorker.prototype.postNamedMessage = function(messageName, messageData, replyCb, replyCbContext) {
		var message = makeMessage(messageName, messageData);
		doPostMessage.call(this, message, replyCb, replyCbContext);
		return message.id;
	};

	// EXPORTED
	// sends a reply to a message from the LocalEnvWorker
	// - parameter 1 (`orgMessage`) should be the message (or id of the message) originally received from the LocalEnvWorker
	// - otherwise works exactly like postNamedMessage
	// - NOTE: replies will only be handled by replyCbs registered during the original send
	//   - if a sender is not expecting a reply, it will never be handled
	LocalEnvWorker.prototype.postReply = function(orgMessage, messageData, replyCb, replyCbContext) {
		var replyToID = (typeof orgMessage === 'object') ? orgMessage.id : orgMessage;
		var message = makeMessage('reply', messageData, replyToID);
		doPostMessage.call(this, message, replyCb, replyCbContext);
		return message.id;
	};

	// EXPORTED
	// informs the receiver that no more data will stream, allowing it to release its listeners
	// - parameter 1 (`orgMessageID`) should be the first message's id (returned by postNamedMessage/postReply)
	LocalEnvWorker.prototype.endMessage = function(orgMessageID) {
		return this.postNamedMessage('endMessage', orgMessageID);
	};

	// INTERNAL
	// message object builder
	function makeMessage(name, data, replyToId) {
		var message = {
			id       : gen_mid(),
			reply_to : replyToId,
			name     : name,
			data     : data
		};
		return message;
	}

	// INTERNAL
	// functional body of the post* functions
	// - should be called with the LocalEnvWorker bound to `this`
	function doPostMessage(message, replyCb, replyCbContext) {
		if (message.name in this.messageBuffers) {
			// dont send; queue message in the buffer
			this.messageBuffers[message.name].push([message, replyCb, replyCbContext]);
		} else {
			if (replyCb && typeof replyCb === 'function') {
				this.replyCbs[message.id] = { func:replyCb, context:replyCbContext };
			}
			if (this.isLogging) { console.log('sending', message); }
			this.worker.postMessage(message);
		}
	}

	// EXPORTED
	// registers a callback to handle messages from the LocalEnvWorker
	// - `messageName` and `func` are required
	LocalEnvWorker.prototype.addNamedMessageListener = function(messageName, func, context) {
		if (!(messageName in this.messageListeners)) {
			// create new listener array
			this.messageListeners[messageName] = [];
		}
		// add to list
		this.messageListeners[messageName].push({ func:func, context:context });
	};
	LocalEnvWorker.prototype.onNamedMessage = LocalEnvWorker.prototype.addNamedMessageListener;

	// EXPORTED
	// removes a given callback from the message listeners
	LocalEnvWorker.prototype.removeNamedMessageListener = function(messageName, func) {
		if (messageName in this.messageListeners) {
			// filter out the listener
			var filterFn = function(listener) { return listener.func != func; };
			this.messageListeners[messageName] = this.messageListeners[messageName].filter(filterFn);
			// remove array if empty
			if (this.messageListeners[messageName].length === 0) {
				delete this.messageListeners[messageName];
			}
		}
	};

	// EXPORTED
	// removes all callbacks from the given message
	LocalEnvWorker.prototype.removeAllNamedMessageListeners = function(messageName) {
		if (messageName in this.messageListeners) {
			delete this.messageListeners[messageName];
		}
	};

	// EXPORTED
	// delays all messages of the given type until `releaseMessages` is called
	LocalEnvWorker.prototype.bufferMessages = function(messageName) {
		if (!(messageName in this.messageBuffers)) {
			this.messageBuffers[messageName] = [];
		}
	};

	// EXPORTED
	// stops buffering and sends all queued messages
	LocalEnvWorker.prototype.releaseMessages = function(messageName) {
		if (messageName in this.messageBuffers) {
			var buffers = this.messageBuffers[messageName];
			delete this.messageBuffers[messageName]; // clear the entry, so `doPostMessage` knows to send
			buffers.forEach(function(buffer) {
				doPostMessage.apply(this, buffer);
			}, this);
		}
	};

	// EXPORTED
	// instructs the LocalEnvWorker to set the given name to null
	// - eg LocalEnvWorker.nullify('XMLHttpRequest'); // no ajax
	LocalEnvWorker.prototype.nullify = function(name) {
		this.postNamedMessage('nullify', name);
	};

	// EXPORTED
	// instructs the LocalEnvWorker to import the JS given by the URL
	// - eg LocalEnvWorker.importJS('/my/script.js', onImported);
	// - urls may be a string or an array of strings
	// - note, `urls` may contain data-urls of valid JS
	// - `cb` is called with the respond message
	//   - on error, .data will be { error:true, reason:'message' }
	LocalEnvWorker.prototype.importScripts = function(urls, cb) {
		this.postNamedMessage('importScripts', urls, cb);
	};

	// EXPORTED
	// destroys the LocalEnvWorker
	LocalEnvWorker.prototype.terminate = function() {
		// just to be safe about callbacks, lets drop all our listeners
		// :TODO: does this do anything?
		var k; // just shut up, JSLint
		for (k in this.messageListeners) {
			delete this.messageListeners[k];
		}
		for (k in this.replyCbs) {
			delete this.replyCbs[k];
		}
		// kill the worker
		this.worker.terminate();
		this.worker = null;
	};
})();// Env Servers
// ===========

(function() {
	var __cur_id = 1;
	function gen_id() { return __cur_id++; }

	// Server
	// ======
	// EXPORTED
	// core type for all servers, should be used as a prototype
	function Server() {
		this.config = { id:gen_id(), domain:null };
	}
	local.env.Server = Server;

	// request handler, should be overwritten by subclasses
	Server.prototype.handleHttpRequest = function(request, response) {
		response.writeHead(0, 'server not implemented');
		response.end();
	};

	// called before server destruction, should be overwritten by subclasses
	// - executes syncronously - does not wait for cleanup to finish
	Server.prototype.terminate = function() {
	};

	// retrieve server source
	// - `requester` is the object making the request
	Server.prototype.getSource = function(requester) {
		return this.handleHttpRequest.toString();
	};


	// WorkerServer
	// ============
	// EXPORTED
	// wrapper for servers run within workers
	// - `config` must include `src`, which must be a URL
	function WorkerServer(config, loaderrorCb) {
		config = config || {};
		Server.call(this);
		this.state = WorkerServer.BOOT;

		for (var k in config)
			this.config[k] = config[k];

		if (!this.config.src)
			this.config.src = '';
		if (!this.config.srcBaseUrl) {
			if (/^data/.test(this.config.src) === false) // scriptBaseUrl is used for relative-path require()s in the worker
				this.config.srcBaseUrl = this.config.src.replace(/\/[^/]+$/,'/');
			else
				this.config.srcBaseUrl = '';
		}
		if (!this.config.domain) // assign a temporary label for logging if no domain is given yet
			this.config.domain = '<'+this.config.src.slice(0,40)+'>';
		this.config.environmentHost = window.location.host;

		this.loaderrorCb = loaderrorCb;
		this.readyMessage = null;
		this.canLoadUserscript = false;

		// initialize the web worker with the bootstrap script
		this.worker = new local.env.Worker(null, { bootstrapUrl:local.env.config.workerBootstrapUrl });
		this.worker.bufferMessages('httpRequest'); // queue http requests until the app script is loaded
		this.worker.onNamedMessage('ready', this.onWorkerReady, this);
		this.worker.onNamedMessage('terminate', this.terminate, this);
		this.worker.onNamedMessage('httpRequest', this.onWorkerHttpRequest, this);
		this.worker.onNamedMessage('httpSubscribe', this.onWorkerHttpSubscribe, this);
		this.worker.onNamedMessage('log', this.onWorkerLog, this);
	}
	local.env.WorkerServer = WorkerServer;
	WorkerServer.prototype = Object.create(Server.prototype);

	// EXPORTED
	// possible states
	WorkerServer.BOOT   = 0; // initial, not ready to do work
	WorkerServer.READY  = 1; // local bootstrap is loaded, awaiting user script
	WorkerServer.ACTIVE = 2; // local bootstrap and user script loaded, server may handle requests
	WorkerServer.DEAD   = 3; // should be cleaned up

	// runs Local initialization for a worker thread
	// - called when the myhouse worker_bootstrap has finished loading
	WorkerServer.prototype.onWorkerReady = function(message) {
		// disable dangerous APIs
		this.worker.nullify('XMLHttpRequest');
		this.worker.nullify('Worker');
		this.worker.nullify('importScripts');
		// hold onto the ready message and update state, so the environment can finish preparing us
		// (the config must be locked before we continue from here)
		this.state = WorkerServer.READY;
		this.readyMessage = message;
		if (this.canLoadUserscript)
			this.loadUserScript();
	};

	WorkerServer.prototype.loadUserScript = function() {
		// flag that the environment is ready for us
		this.canLoadUserscript = true;
		if (this.state != WorkerServer.READY)
			return; // wait for the worker to be ready
		// send config to the worker thread
		this.worker.postReply(this.readyMessage, this.config);
		// load the server program
		var self = this;
		this.worker.importScripts(this.config.src, function(importRes) {
			if (importRes.data.error) {
				if (self.loaderrorCb) self.loaderrorCb(importRes.data);
				self.terminate();
				return;
			}
			if (self.state != WorkerServer.DEAD) {
				self.state = WorkerServer.ACTIVE;
				self.worker.releaseMessages('httpRequest'); // stop buffering
			}
		});
	};

	// destroys the server
	// - called when the worker has died, or when the environment wants the server to die
	WorkerServer.prototype.terminate = function() {
		this.state = WorkerServer.DEAD;
		this.worker.terminate();
	};

	// retrieve server source
	// - `requester` is the object making the request
	WorkerServer.prototype.getSource = function(requester) {
		if (/^data/.test(this.config.src))
			return local.promise(atob(this.config.src.split(',')[1] || ''));

		// request from host
		var jsRequest = { method:'get', url:this.config.src, headers:{ accept:'application/javascript' }};
		return local.http.dispatch(jsRequest, requester).then(
			function(res) { return res.body; },
			function(res) {
				console.log('failed to retrieve worker source:', res);
				return '';
			}
		);
	};

	// logs the message data
	// - allows programs to run `app.postMessage('log', 'my log message')`
	WorkerServer.prototype.onWorkerLog = function(message) {
		console.log('['+this.config.domain+']', message.data);
	};

	// dispatches a request to local.http and sends the response back to the worker
	// - called when the worker-server issues a request
	// - mirrors app.onNamedMessage('httpRequest') in worker/http.js
	WorkerServer.prototype.onWorkerHttpRequest = function(message) {
		var self = this;
		var request = message.data;

		// pipe the response back to the worker
		var handleResponse = function(response) {
			var stream = self.worker.postReply(message, response);
			if (response.isConnOpen) {
				response.on('data', function(data) { self.worker.postNamedMessage(stream, data); });
				response.on('end', function() { self.worker.endMessage(stream); });
			} else
				self.worker.endMessage(stream);
		};

		// execute the request
		local.http.dispatch(message.data, this).then(handleResponse, handleResponse);
	};

	// routes the subscribe to local.http and sends the events back to the worker
	// - called when the worker-server issues a subscribe
	WorkerServer.prototype.onWorkerHttpSubscribe = function(message) {
		var self = this;
		var request = message.data;

		// create the stream
		// :TODO: no close handling... is this a memory leak?
		var eventStream = local.http.subscribe(request);

		// listen for further requests - they indicate individual message subscribes
		this.worker.onNamedMessage(message.id, function(message2) {
			var eventNames = message2.data;
			var msgStream = self.worker.postReply(message2);
			// begin listening
			eventStream.on(eventNames, function(e) {
				// pipe back
				self.worker.postNamedMessage(msgStream, e);
			});
		});
	};

	// dispatches the request to the worker for handling
	// - called when a request is issued to the worker-server
	// - mirrors setRequestDispatcher(function) in worker/http.js
	WorkerServer.prototype.handleHttpRequest = function(request, response) {
		this.worker.postNamedMessage('httpRequest', request, function(reply) {
			if (!reply.data) { throw "Invalid httpRequest reply to document from worker"; }

			response.writeHead(reply.data.status, reply.data.reason, reply.data.headers);
			if (typeof reply.data.body != 'undefined' && reply.data.body !== null)
				response.write(reply.data.body);

			this.worker.onNamedMessage(reply.id, function(streamMessage) {
				if (streamMessage.name === 'endMessage') {
					response.end();
				} else {
					// :TODO: update headers?
					response.write(streamMessage.data);
				}
			});
		}, this);
	};

})();// Env Core
// ========

local.env.config = {
	workerBootstrapUrl : 'lib/worker.min.js'
};

local.env.servers = {};
local.env.clientRegions = {};
local.env.numServers = 0;
local.env.numClientRegions = 0;

local.env.addServer = function(domain, server) {
	// instantiate the application
	server.config.domain = domain;
	local.env.servers[domain] = server;
	local.env.numServers++;

	// allow the user script to load
	if (server.loadUserScript)
		server.loadUserScript();

	// register the server
	local.http.registerLocal(domain, server.handleHttpRequest, server);

	return server;
};

local.env.killServer = function(domain) {
	var server = local.env.servers[domain];
	if (server) {
		local.http.unregisterLocal(domain);
		server.terminate();
		delete local.env.servers[domain];
		local.env.numServers--;
	}
};

local.env.getServer = function(domain) { return local.env.servers[domain]; };
local.env.listFilteredServers = function(fn) {
	var list = {};
	for (var k in local.env.servers) {
		if (fn(local.env.servers[k], k)) list[k] = local.env.servers[k];
	}
	return list;
};

local.env.addClientRegion = function(clientRegion) {
	var id;
	if (typeof clientRegion == 'object')
		id = clientRegion.id;
	else {
		id = clientRegion;
		clientRegion = new local.client.Region(id);
	}
	local.env.clientRegions[clientRegion.id] = clientRegion;
	local.env.numClientRegions++;
	return clientRegion;
};

local.env.removeClientRegion = function(id) {
	if (local.env.clientRegions[id]) {
		local.env.clientRegions[id].terminate();
		delete local.env.clientRegions[id];
		local.env.numClientRegions--;
	}
};

local.env.getClientRegion = function(id) { return local.env.clientRegions[id]; };

// dispatch monkeypatch
// - allows the deployment to control request permissions / sessions / etc
// - adds the `origin` parameter, which is the object responsible for the request
var __envDispatchWrapper;
var orgLinkDispatchFn = local.http.dispatch;
local.http.dispatch = function(req, origin) {
	// parse the url
	// (urld = url description)
	if (!req.url)
		req.url = local.http.joinUrl(req.host, req.path);
	if (!req.urld)
		req.urld = local.http.parseUri(req.url);

	var res = __envDispatchWrapper.call(this, req, origin, orgLinkDispatchFn);
	if (res instanceof local.Promise) { return res; }

	// make sure we respond with a valid client response
	if (!res) {
		res = new local.http.ClientResponse(0, 'Environment did not correctly dispatch the request');
		res.end();
	} else if (!(res instanceof local.http.ClientResponse)) {
		if (typeof res == 'object') {
			var res2 = new local.http.ClientResponse(res.status, res.reason);
			res2.headers = res.headers;
			res2.end(res.body);
			res = res2;
		} else {
			res = new local.http.ClientResponse(0, res.toString());
			res.end();
		}
	}

	// and make sure it's wrapped in a promise
	var p = local.promise();
	if (res.status >= 400 || res.status === 0)
		p.reject(res);
	else
		p.fulfill(res);
	return p;
};
__envDispatchWrapper = function(req, origin, dispatch) {
	return dispatch(req);
};
local.env.setDispatchWrapper = function(fn) {
	__envDispatchWrapper = fn;
};

// response html post-process
// - override this to modify html after it has entered the document
// - useful for adding local.env widgets
var __postProcessRegion = function() {};
local.env.postProcessRegion = function(elem) { return __postProcessRegion(elem); };
local.env.setRegionPostProcessor = function(fn) {
	__postProcessRegion = fn;
};})();