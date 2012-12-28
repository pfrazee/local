(function(exports) {
	var cur_pid = 1;
	function gen_pid() { return cur_pid++; }

	// Server
	// ======
	// EXPORTED
	// wrapper for user applications
	function Server(scriptUrl) {
		this.config = Object.freeze({
			pid       : gen_pid(),
			scriptUrl : scriptUrl
		});
		this.state = Server.BOOT;

		this.worker = new MyHouse.Sandbox(null, { bootstrapUrl:'/lib/worker_bootstrap.js' });
		this.worker.bufferMessages('httpRequest');
		this.worker.onMessage('ready', this.onWorkerReady, this);
		this.worker.onMessage('loaded', this.onWorkerLoaded, this);
		this.worker.onMessage('terminate', this.terminate, this);
		this.worker.onMessage('httpRequest', this.onWorkerHttpRequest, this);
	}

	// EXPORTED
	// possible states
	Server.BOOT   = 0;
	Server.READY  = 1;
	Server.ACTIVE = 2;
	Server.DEAD   = 3;

	// runs LinkAP initialization for a worker thread
	// - called when the myhouse worker_bootstrap has finished loading
	Server.prototype.onWorkerReady = function(message) {
		this.state = Server.READY;
		this.worker.postReply(message, { pid:this.config.pid });
		this.worker.importScripts('/lib/worker_core.js');
		this.worker.nullify('XMLHttpRequest'); // disable ajax
		this.worker.importScripts(this.config.scriptUrl); // load the program
	};

	// starts activity with the server
	// - called when the link-ap worker_core has finished loading
	Server.prototype.onWorkerLoaded = function(message) {
		this.state = Server.ACTIVE;
		this.worker.releaseMessages('httpRequest'); // stop buffering
	};

	// destroys the server
	// - called when the worker has died, or when the environment wants the server to die
	Server.prototype.terminate = function() {
		this.state = Server.DEAD;
		this.worker.terminate();
	};

	// dispatches a request to Link and sends the response back to the worker
	// - called when the worker-server issues a request
	// - mirrors app.onMessage('httpRequest') in worker_core.js
	Server.prototype.onWorkerHttpRequest = function(message) {
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
	Server.prototype.postHttpRequestMessage = function(request, response) {
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
})(App);