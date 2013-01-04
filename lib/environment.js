// LinkAP Environment
// ==================
// pfraze 2012
var Environment = {};(function(exports) {
	var cur_id = 1;
	function gen_id() { return cur_id++; }

	// Server
	// ======
	// EXPORTED
	// core type for all servers, should be used as a prototype
	function Server() {
		this.config = { id:gen_id(), domain:null };
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

	// retrieve server source
	// - `requester` is the object making the request
	Server.prototype.getSource = function(requester) {
		return this.handleHttpRequest.toString();
	};


	// WorkerServer
	// ============
	// EXPORTED
	// wrapper for servers run within workers
	// - `config` must include `scriptUrl` or `script`
	function WorkerServer(config) {
		Server.call(this);
		if (config) {
			for (var k in config)
				this.config[k] = config[k];
		}

		// initialize the web worker with the MyHouse bootstrap script
		this.worker = new MyHouse.Sandbox(null, { bootstrapUrl:'/lib/worker_bootstrap.js' });
		this.worker.bufferMessages('httpRequest'); // queue http requests until the app script is loaded
		this.worker.onMessage('ready', this.onWorkerReady, this);
		this.worker.onMessage('loaded', this.onWorkerLoaded, this);
		this.worker.onMessage('terminate', this.terminate, this);
		this.worker.onMessage('httpRequest', this.onWorkerHttpRequest, this);
		this.worker.onMessage('log', this.onWorkerLog, this);
	}
	WorkerServer.prototype = Object.create(Server.prototype);

	// runs LinkAP initialization for a worker thread
	// - called when the myhouse worker_bootstrap has finished loading
	WorkerServer.prototype.onWorkerReady = function(message) {
		// send config to the worker thread
		this.worker.postReply(message, this.config);
		// load the link-ap core script into the worker
		this.worker.importScripts('/lib/worker_core.js');
		// disable ajax in the worker
		this.worker.nullify('XMLHttpRequest');
		// load the server program
		var url = this.config.scriptUrl;
		if (!url && this.config.script) {
			// convert the given source to an object url
			var jsBlob = new Blob([this.config.script], { type:'application/javascript' });
			url = (window.webkitURL ? webkitURL : URL).createObjectURL(jsBlob);
		}
		this.worker.importScripts(url);
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

	// retrieve server source
	// - `requester` is the object making the request
	Server.prototype.getSource = function(requester) {
		var scriptUrl = this.config.scriptUrl;
		if (scriptUrl) {
			var scriptPromise = promise();
			if (/\/\//.test(scriptUrl) === false) { // no protocol?
				// assume it's a relative path referring to our host
				scriptUrl = window.location.origin + scriptUrl;
			}

			// request from host
			var jsRequest = { method:'get', url:scriptUrl, headers:{ accept:'application/javascript' }};
			Environment.request(requester, jsRequest)
				.then(function(res) {
					res.on('end', function() {
						scriptPromise.fulfill(res.body);
					});
				})
				.except(function(err) {
					console.log('failed to retrieve worker source:', err.message, err.response);
					scriptPromise.reject(err);
				});
			return scriptPromise;
		} else {
			return this.config.script;
		}
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
	function Client(id) {
		this.context = null;

		this.element = document.getElementById(id);
		if (!this.element) { throw "Client target element not found"; }
		bindEventHandlers.call(this);
		CommonClient.listen(this.element);
	}

	function bindEventHandlers() {
		var self = this;
		this.element.addEventListener('request', function(e) {
			var request = e.detail;

			// sane defaults
			request.headers = request.headers || {};
			request.headers.accept = request.headers.accept || 'text/html';

			// choose the request target
			var requestTarget;
			if (e.target.tagName == 'OUTPUT') {
				requestTarget = e.target;
			} else {
				requestTarget = document.getElementById(request.target) || self.element;
			}

			// issue request
			promise(Environment.request(self, request))
				.then(function(res) {
					// success, send back to common client
					res.on('end', function() {
						CommonClient.handleResponse(requestTarget, self.element, res);
						Environment.postProcessRegion(requestTarget);
					});
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

	exports.servers    = {};
	exports.clients    = {};
	exports.numServers = 0;
	exports.numClients = 0;

	exports.addServer = function(domain, server) {
		// instantiate the application
		server.environment = this;
		server.config.domain = domain;
		Environment.servers[server.config.id] = server;
		Environment.numServers++;

		// register the server
		Link.registerLocal(domain, server.handleHttpRequest, server);

		return server;
	};

	exports.killServer = function(id) {
		var server = Environment.servers[id];
		if (server) {
			Link.unregisterLocal(server.config.domain);
			server.terminate();
			delete Environment.servers[id];
		}
	};

	exports.getServerById = function(id) {
		return Environment.servers[id];
	};

	exports.listServersById = function() {
		return Environment.servers;
	};

	exports.getServerByDomain = function(domain) {
		var requestHandler = Link.getLocal(domain);
		if (requestHandler) {
			return requestHandler.context; // Server object is stored in the handler's context
		}
		return null;
	};

	exports.listServersByDomain = function() {
		return Link.getLocalRegistry().map(function(server) { return server.context; });
	};

	exports.addClient = function(id) {
		var client = new Environment.Client(id);
		Environment.clients[id] = client;
		Environment.numClients++;
		return client;
	};

	exports.getClient = function(id) {
		return Environment.clients[id];
	};

	// request wrapper
	// - used by all WorkerServers, may be used elsewhere as desired
	// - override this to control request permissions / sessions / etc
	exports.request = function(origin, req) {
		return Link.request(req);
	};

	// response html post-process
	// - override this to modify html after it has entered the document
	// - useful for adding environment widgets
	exports.postProcessRegion = function() {};
})(Environment);