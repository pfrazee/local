// LinkAP Environment
// ==================
// pfraze 2012
var Environment = {};(function(exports) {
	var cur_pid = 1;
	function gen_pid() { return cur_pid++; }

	// Server
	// ======
	// EXPORTED
	// core type for all servers, should be used as a prototype
	function Server() {
		this.config = { pid:gen_pid(), domain:null };
		this.state = Server.BOOT;
		this.environment = null; // will be set by Environment.addServer
	}

	// EXPORTED
	// possible states
	Server.BOOT   = 0; // initial, not ready to do work
	Server.ACTIVE = 1; // server may handle requests
	Server.DEAD   = 2; // should be cleaned up

	// request handler, should be overwritten by subclasses
	Server.prototype.handleHttpRequest = function(request, response) {
		response.writeHead(0, 'server not implemented');
		response.end();
	};

	// marks the server for cleanup
	Server.prototype.terminate = function() {
		this.state = Server.DEAD;
	};


	// WorkerServer
	// ============
	// EXPORTED
	// wrapper for servers run within workers
	function WorkerServer(scriptUrl) {
		Server.call(this);
		this.config.scriptUrl = scriptUrl;

		// initialize the web worker with the MyHouse bootstrap script
		this.worker = new MyHouse.Sandbox(null, { bootstrapUrl:'/lib/worker_bootstrap.js' });
		this.worker.bufferMessages('httpRequest'); // queue http requests until the app script is loaded
		this.worker.onMessage('ready', this.onWorkerReady, this);
		this.worker.onMessage('loaded', this.onWorkerLoaded, this);
		this.worker.onMessage('terminate', this.terminate, this);
		this.worker.onMessage('httpRequest', this.onWorkerHttpRequest, this);
		this.worker.onMessage('log', this.onWorkerLog, this);
	}
	WorkerServer.prototype = Object.create(Server);

	// runs LinkAP initialization for a worker thread
	// - called when the myhouse worker_bootstrap has finished loading
	WorkerServer.prototype.onWorkerReady = function(message) {
		// send config info to the worker thread
		this.worker.postReply(message, { pid:this.config.pid });
		// load the link-ap core script into the worker
		this.worker.importScripts('/lib/worker_core.js');
		// disable ajax in the worker
		this.worker.nullify('XMLHttpRequest');
		// load the server program
		this.worker.importScripts(this.config.scriptUrl);
	};

	// starts activity with the server
	// - called when the link-ap worker_core has finished loading
	WorkerServer.prototype.onWorkerLoaded = function(message) {
		this.state = Server.ACTIVE;
		this.worker.releaseMessages('httpRequest'); // stop buffering
	};

	// destroys the server
	// - called when the worker has died, or when the environment wants the server to die
	WorkerServer.prototype.terminate = function() {
		this.state = Server.DEAD;
		this.worker.terminate();
	};

	// logs the message data
	// - allows programs to run `app.postMessage('log', 'my log message')`
	WorkerServer.prototype.onWorkerLog = function(message) {
		console.log('['+this.config.domain+']', message.data);
	};

	// dispatches a request to Link and sends the response back to the worker
	// - called when the worker-server issues a request
	// - mirrors app.onMessage('httpRequest') in worker_core.js
	WorkerServer.prototype.onWorkerHttpRequest = function(message) {
		var self = this;
		var request = message.data;

		// pipe the response back to the worker
		var handleResponse = function(response) {
			var stream = self.worker.postReply(message, response);
			response.on('data', function(data) { self.worker.postMessage(stream, data); });
			response.on('end', function() { self.worker.endMessage(stream); });
		};

		// all errors, just send back to the worker
		var handleErrors = function(err) { handleResponse(err.response); };

		// execute the request
		promise(this.environment.request(this, message.data))
			.then(handleResponse)
			.except(handleErrors);
	};

	// dispatches the request to the sandbox for handling
	// - called when a request is issued to the worker-server
	// - mirrors Link.setRequestDispatcher(function) in worker_core.js
	WorkerServer.prototype.handleHttpRequest = function(request, response) {
		this.worker.postMessage('httpRequest', request, function(reply) {
			if (!reply.data) { throw "Invalid httpRequest reply to document from worker"; }

			response.writeHead(reply.data.status, reply.data.reason, reply.data.headers);
			if (reply.data.body)
				response.write(reply.data.body);

			this.worker.onMessage(reply.id, function(streamMessage) {
				if (streamMessage.name === 'endMessage') {
					response.end();
				} else {
					// :TODO: update headers?
					response.write(streamMessage.data);
				}
			});
		}, this);
	};

	exports.Server = Server;
	exports.WorkerServer = WorkerServer;
})(Environment);(function(exports) {

	// Client
	// ======
	// EXPORTED
	// an isolated region of the DOM
	function Client(elemSelector) {
		this.context = null;

		this.element = document.querySelector(elemSelector);
		if (!this.element) { throw "Client target element not found"; }
		bindEventHandlers.call(this);
		CommonClient.listen(this.element);
	}

	function bindEventHandlers() {
		var self = this;
		this.element.addEventListener('request', function(e) {
			var request = e.detail;
			promise(Link.request(request))
				.then(function(res) {
					var requestTarget = document.getElementById(request.target) || self.element;
					res.on('end', function() {
						CommonClient.handleResponse(requestTarget, self.element, res);
					});
				})
				.except(function(err) {
					console.log('Error:', err.message);
				});
			e.preventDefault();
			e.stopPropagation();
		});
	}

	Client.prototype.request = function(request) {
		if (typeof request === 'string') {
			request = { method:'get', url:request, headers:{ accept:'text/html' }};
		}
		var re = new CustomEvent('request', { bubbles:true, cancelable:true, detail:request });
		this.element.dispatchEvent(re);
	};

	Client.prototype.terminate = function() {
		// :TODO:
		// CommonClient.unlisten(this);
	};

	exports.Client = Client;
})(Environment);(function(exports) {

	var servers    = {};
	var clients    = {};
	var numServers = 0;
	var numClients = 0;

	exports.addServer = function(domain, server) {
		// instantiate the application
		server.environment = this;
		server.config.domain = domain;
		servers[server.config.id] = server;
		numServers++;

		// register the server
		Link.registerLocal(domain, server.handleHttpRequest, server);

		return server;
	};

	exports.addClient = function(selector) {
		var client = new Environment.Client(selector);
		clients[selector] = client;
		numClients++;
		return client;
	};

	// request wrapper
	// - used by all WorkerServers, may be used elsewhere as desired
	// - override this to control request permissions / sessions / etc
	exports.request = function(origin, req) {
		return Link.request(req);
	};
})(Environment);