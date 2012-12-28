(function(exports) {
	var cur_pid = 1;
	function gen_pid() { return cur_pid++; }

	// Server
	// ======
	// EXPORTED
	// core type for all servers, should be used as a prototype
	function Server() {
		this.config = { pid:gen_pid() };
		this.state = Server.BOOT;
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

		this.worker = new MyHouse.Sandbox(null, { bootstrapUrl:'/lib/worker_bootstrap.js' });
		this.worker.bufferMessages('httpRequest');
		this.worker.onMessage('ready', this.onWorkerReady, this);
		this.worker.onMessage('loaded', this.onWorkerLoaded, this);
		this.worker.onMessage('terminate', this.terminate, this);
		this.worker.onMessage('httpRequest', this.onWorkerHttpRequest, this);
	}
	WorkerServer.prototype = Object.create(Server);

	// runs LinkAP initialization for a worker thread
	// - called when the myhouse worker_bootstrap has finished loading
	WorkerServer.prototype.onWorkerReady = function(message) {
		this.worker.postReply(message, { pid:this.config.pid });
		this.worker.importScripts('/lib/worker_core.js');
		this.worker.nullify('XMLHttpRequest'); // disable ajax
		this.worker.importScripts(this.config.scriptUrl); // load the program
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

	// dispatches a request to Link and sends the response back to the worker
	// - called when the worker-server issues a request
	// - mirrors app.onMessage('httpRequest') in worker_core.js
	WorkerServer.prototype.onWorkerHttpRequest = function(message) {
		var self = this;
		Link.request(message.data)
			.then(function(res) {
				var stream = self.worker.postReply(message, res);
				res.on('data', function(data) {
					self.worker.postMessage(stream, data);
				});
				res.on('end', function() {
					self.worker.endMessage(stream);
				});
			})
			.except(function(err) {
				this.worker.postReply(message, err.response);
			});
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
					response.write(streamMessage.data.body);
				}
			});
		}, this);
	};

	exports.Server = Server;
	exports.WorkerServer = WorkerServer;
})(App);