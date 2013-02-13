(function(exports) {
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

		if (!this.config.domain) {
			this.config.domain = (this.config.scriptUrl) ?
				'<'+this.config.scriptUrl+'>' :
				'{'+this.config.script.slice(0,20)+'}';
		}

		// initialize the web worker with the MyHouse bootstrap script
		this.worker = new MyHouse.Sandbox(null, { bootstrapUrl:Environment.config.workerBootstrapUrl });
		this.worker.bufferMessages('httpRequest'); // queue http requests until the app script is loaded
		this.worker.onMessage('ready', this.onWorkerReady, this);
		this.worker.onMessage('loaded', this.onWorkerLoaded, this);
		this.worker.onMessage('terminate', this.terminate, this);
		this.worker.onMessage('httpRequest', this.onWorkerHttpRequest, this);
		this.worker.onMessage('httpSubscribe', this.onWorkerHttpSubscribe, this);
		this.worker.onMessage('log', this.onWorkerLog, this);
	}
	WorkerServer.prototype = Object.create(Server.prototype);

	// runs LinkAP initialization for a worker thread
	// - called when the myhouse worker_bootstrap has finished loading
	WorkerServer.prototype.onWorkerReady = function(message) {
		// disable ajax in the worker
		this.worker.nullify('XMLHttpRequest');
		// send config to the worker thread
		this.worker.postReply(message, this.config);
		this.worker.importScripts('worker_httpl.js');
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
	WorkerServer.prototype.getSource = function(requester) {
		var scriptUrl = this.config.scriptUrl;
		if (scriptUrl) {
			var scriptPromise = promise();
			if (/\/\//.test(scriptUrl) === false) { // no protocol?
				// assume it's a relative path referring to our host
				scriptUrl = 'http://'+window.location.host + scriptUrl;
			}

			// request from host
			var jsRequest = { method:'get', url:scriptUrl, headers:{ accept:'application/javascript' }};
			Environment.dispatch(requester, jsRequest)
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
		var handleErrors = function(err) {
			var stream = self.worker.postReply(message, err.response);
			self.worker.endMessage(stream);
		};

		// execute the request
		promise(this.environment.dispatch(this, message.data))
			.then(handleResponse)
			.except(handleErrors);
	};

	// routes the subscribe to Link and sends the events back to the worker
	// - called when the worker-server issues a subscribe
	WorkerServer.prototype.onWorkerHttpSubscribe = function(message) {
		var self = this;
		var request = message.data;

		// create the stream
		// :TODO: no close handling... is this a memory leak?
		var eventStream = Link.subscribe(request);

		// listen for further requests - they indicate individual message subscribes
		this.worker.onMessage(message.id, function(message2) {
			var eventNames = message2.data;
			var msgStream = self.worker.postReply(message2);
			// begin listening
			eventStream.on(eventNames, function(e) {
				// pipe back
				self.worker.postMessage(msgStream, e);
			});
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
					// :TODO: update headers?
					response.write(streamMessage.data);
				}
			});
		}, this);
	};

	exports.Server = Server;
	exports.WorkerServer = WorkerServer;
})(Environment);