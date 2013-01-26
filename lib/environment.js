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
		var handleErrors = function(err) { handleResponse(err.response); };

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
})(Environment);(function(exports) {

	// ClientRegion
	// ============
	// EXPORTED
	// an isolated region of the DOM
	function ClientRegion(id) {
		this.id = id;
		this.contextUrl = ''; // used for relative links

		this.element = document.getElementById(id);
		if (!this.element) { throw "ClientRegion target element not found"; }

		this.__bindEventHandlers();
		CommonClient.listen(this.element);
	}

	ClientRegion.prototype.dispatchRequest = function(request) {
		if (typeof request === 'string') {
			request = { method:'get', url:request, headers:{ accept:'text/html' }};
		}
		var re = new CustomEvent('request', { bubbles:true, cancelable:true, detail:request });
		this.element.dispatchEvent(re);
	};

	ClientRegion.prototype.terminate = function() {
		CommonClient.unlisten(this);
		this.element.removeEventListener('request', this.listenerFn);
	};

	ClientRegion.prototype.__bindEventHandlers = function() {
		this.listenerFn = (function(e) {
			e.preventDefault();
			e.stopPropagation();

			var request = e.detail;
			this.__reviewRequest(request);
			this.__contextualizeRequest(request);

			var self = this;
			promise(Environment.dispatch(this, request))
				.then(function(response) {
					self.__updateContext(request, response);
					response.on('end', function() { self.__handleResponse(e, request, response); });
				});
		}).bind(this);
		this.element.addEventListener('request', this.listenerFn);
	};

	ClientRegion.prototype.__reviewRequest = function(request) {
		// sane defaults
		request.headers = request.headers || {};
		request.headers.accept = request.headers.accept || 'text/html';
	};

	ClientRegion.prototype.__contextualizeRequest = function(request) {
		// relative urls
		var urld = Link.parseUri(request);
		if (!urld.protocol) {
			// build a new url from the current context
			var newUrl = (this.contextUrl + request.url);
			// reduce the string's '..' relatives
			// :TODO: I'm sure there's a better algorithm for this
			var lastRequestHost = Link.parseUri(this.contextUrl).host;
			do {
				request.url = newUrl;
				newUrl = request.url.replace(/[^\/]+\/\.\.\//i, '');
			} while (newUrl != request.url && Link.parseUri(newUrl).host == lastRequestHost);
			delete request.host;
			delete request.path;
		}
	};

	ClientRegion.prototype.__updateContext = function(request, response) {
		// track location for relative urls
		var urld = Link.parseUri(request);
		self.contextUrl = urld.protocol + '://' + urld.authority + urld.directory;
	};

	ClientRegion.prototype.__handleResponse = function(e, request, response) {
		var requestTarget = this.__chooseRequestTarget(e, request);
		CommonClient.handleResponse(requestTarget, this.element, response);
		Environment.postProcessRegion(requestTarget);
	};

	ClientRegion.prototype.__chooseRequestTarget = function(e, request) {
		if (e.target.tagName == 'OUTPUT') {
			return e.target;
		} else {
			return document.getElementById(request.target) || this.element;
		}
	};

	exports.ClientRegion = ClientRegion;
})(Environment);(function(exports) {

	exports.config = {
		workerBootstrapUrl : 'lib/worker_bootstrap.js'
	};

	exports.servers = {};
	exports.clientRegions = {};
	exports.numServers = 0;
	exports.numClientRegions = 0;

	exports.addServer = function(domain, server) {
		// instantiate the application
		server.environment = this;
		server.config.domain = domain;
		Environment.servers[domain] = server;
		Environment.numServers++;

		// register the server
		Link.registerLocal(domain, server.handleHttpRequest, server);

		return server;
	};

	exports.killServer = function(domain) {
		var server = Environment.servers[domain];
		if (server) {
			Link.unregisterLocal(domain);
			server.terminate();
			delete Environment.servers[domain];
		}
	};

	exports.getServer = function(domain) {
		var requestHandler = Link.getLocal(domain);
		if (requestHandler) {
			return requestHandler.context; // Server object is stored in the handler's context
		}
		return null;
	};

	exports.getServers = function() {
		return Link.getLocalRegistry().map(function(server) { return server.context; });
	};

	exports.addClientRegion = function(clientRegion) {
		var id;
		if (typeof clientRegion == 'object') {
			id = clientRegion.id;
		} else {
			id = clientRegion;
			clientRegion = new Environment.ClientRegion(id);
		}
		Environment.clientRegions[clientRegion.id] = clientRegion;
		Environment.numClientRegions++;
		return clientRegion;
	};

	exports.getClientRegion = function(id) {
		return Environment.clientRegions[id];
	};

	exports.removeClientRegion = function(id) {
		delete Environment.clientRegions[id];
	};

	// dispatch wrapper
	// - used by all WorkerServers, may be used elsewhere as desired
	// - override this to control request permissions / sessions / etc
	exports.dispatch = function(origin, req) {
		var res = this.__dispatch(origin, req);
		if (res instanceof Promise) { return res; }

		// make sure we respond with a valid client response
		if (!res) {
			res = new Link.ClientResponse(0, 'Environment did not correctly dispatch the request');
		} else if (!(res instanceof Link.ClientResponse)) {
			if (typeof res == 'object') {
				var res2 = new Link.ClientResponse(res.status, res.reason);
				res2.headers = res.headers;
				res2.end(res.body);
				res = res2;
			} else {
				res = new Link.ClientResponse(0, res.toString());
			}
		}

		// and make sure it's wrapped in a promise
		var p = promise();
		if (res.status >= 400) {
			p.reject(res);
		} else {
			p.fulfill(res);
		}
		return p;
	};
	exports.__dispatch = function(origin, req) {
		return Link.dispatch(req);
	};
	exports.setDispatchHandler = function(fn) {
		this.__dispatch = fn;
	};

	// response html post-process
	// - override this to modify html after it has entered the document
	// - useful for adding environment widgets
	exports.postProcessRegion = function(elem) { return this.__postProcessRegion(elem); };
	exports.__postProcessRegion = function() {};
	exports.setRegionPostProcessor = function(fn) {
		this.__postProcessRegion = fn;
	};
})(Environment);