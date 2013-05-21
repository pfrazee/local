// Env Servers
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
		this.activeEventStreams = [];

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
		// encode src in base64 if needed
		var src = this.config.src;
		if (src.indexOf('data:application/javascript,') === 0)
			src = 'data:application/javacsript;base64,'+btoa(src.slice(28));
		// load the server program
		var self = this;
		this.worker.importScripts(src, function(importRes) {
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
		this.activeEventStreams.forEach(function(stream) { if (stream) { stream.close(); }});
		this.worker.terminate();
	};

	// retrieve server source
	// - `requester` is the object making the request
	WorkerServer.prototype.getSource = function(requester) {
		if (/^data/.test(this.config.src)) {
			var firstCommaIndex = this.config.src.indexOf(',');
			if (this.config.src.indexOf('data:application/javascript;base64,') === 0)
				return local.promise(atob(this.config.src.slice(firstCommaIndex+1) || ''));
			else
				return local.promise(this.config.src.slice(firstCommaIndex+1) || '');
		}

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
		var eventStream = local.http.subscribe(request);
		var streamIndex = this.activeEventStreams.push(eventStream);
		eventStream.on('error', function() {
			self.activeEventStreams[streamIndex] = null;
		});

		// listen for further requests - they indicate individual message subscribes
		this.worker.onNamedMessage(message.id, function(message2) {
			if (message2 == 'endMessage') {
				// stream closed
				eventStream.close();
			} else {
				var eventNames = message2.data;
				var msgStream = self.worker.postReply(message2);
				// begin listening
				eventStream.on(eventNames, function(e) {
					// pipe back
					if (self.state != WorkerServer.DEAD)
						self.worker.postNamedMessage(msgStream, e);
				});
			}
		});
	};

	// dispatches the request to the worker for handling
	// - called when a request is issued to the worker-server
	// - mirrors setRequestDispatcher(function) in worker/http.js
	WorkerServer.prototype.handleHttpRequest = function(request, response) {
		var worker = this.worker;
		var requestMessage = worker.postNamedMessage('httpRequest', request, function(reply) {
			if (!reply.data) { throw "Invalid httpRequest reply to document from worker"; }

			response.writeHead(reply.data.status, reply.data.reason, reply.data.headers);
			if (typeof reply.data.body != 'undefined' && reply.data.body !== null)
				response.write(reply.data.body);

			worker.onNamedMessage(reply.id, function(streamMessage) {
				if (streamMessage.name === 'endMessage') {
					response.end();
				} else {
					// :TODO: update headers?
					response.write(streamMessage.data);
				}
			});
		}, this);
		if (request.stream) {
			response.clientResponse.on('close', function() {
				// pass this on to the worker so it can close the stream
				worker.endMessage(requestMessage);
			});
		}
	};
})();