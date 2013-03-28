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
	function WorkerServer(config, loaderrorCb) {
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
		this.config.environmentHost = window.location.host;
		this.loaderrorCb = loaderrorCb;

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

	// runs Local initialization for a worker thread
	// - called when the myhouse worker_bootstrap has finished loading
	WorkerServer.prototype.onWorkerReady = function(message) {
		// disable dangerous APIs
		this.worker.nullify('XMLHttpRequest');
		this.worker.nullify('Worker');
		// send config to the worker thread
		this.worker.postReply(message, this.config);
		// load the server program
		var url = this.config.scriptUrl;
		if (!url && this.config.script) {
			// convert the given source to an object url
			var jsBlob = new Blob([this.config.script], { type:'application/javascript' });
			url = (window.webkitURL ? webkitURL : URL).createObjectURL(jsBlob);
		}
		var self = this;
		this.worker.importScripts(url, function(importRes) {
			if (importRes.data.error) {
				if (self.loaderrorCb) self.loaderrorCb(importRes.data);
				self.terminate();
			}
		});
	};

	// starts activity with the server
	// - called when the link-ap worker_core has finished loading
	WorkerServer.prototype.onWorkerLoaded = function(message) {
		if (this.state != Server.DEAD) {
			this.state = Server.ACTIVE;
			this.worker.releaseMessages('httpRequest'); // stop buffering
		}
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
			Link.dispatch(jsRequest, requester)
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
		promise(Link.dispatch(message.data, this))
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
			if (typeof reply.data.body != 'undefined' && reply.data.body !== null)
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
		this.context = {
			url   : '',
			urld  : {},
			links : [],
			type  : '' // content type of the response
		};
		this.featureRights = {}; // feature enable/disable based on security

		this.element = document.getElementById(id);
		if (!this.element) { throw "ClientRegion target element not found"; }

		this.element.addEventListener('request', handleRequest.bind(this));
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
		CommonClient.unlisten(this.element);
		this.element.removeEventListener('request', this.listenerFn);
	};

	ClientRegion.prototype.addRight = function(feature, options) {
		this.featureRights[feature] = options || true;
	};

	ClientRegion.prototype.removeRight = function(feature) {
		delete this.featureRights[feature];
	};

	ClientRegion.prototype.hasRights = function(feature) {
		return this.featureRights[feature];
	};

	function handleRequest(e) {
		e.preventDefault();
		e.stopPropagation();

		var request = e.detail;

		var self = this;
		this.__prepareRequest(request);
		promise(Link.dispatch(request, this))
			.then(function(response) {
				self.__handleResponse(e, request, response);
			})
			.except(function(err) {
				self.__handleResponse(e, request, err.response);
			});
	}

	ClientRegion.prototype.__prepareRequest = function(request) {
		// sane defaults
		request.headers = request.headers || {};
		request.headers.accept = request.headers.accept || 'text/html';
		request.stream = false;

		// relative urls
		var urld = Link.parseUri(request);
		if (!urld.protocol) {
			// build a new url from the current context
			var newUrl = (this.context.url + request.url);
			// reduce the string's '..' relatives
			// :TODO: I'm sure there's a better algorithm for this
			var lastRequestHost = this.context.urld.host;
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
		this.context.urld  = urld;
		this.context.url   = urld.protocol + '://' + urld.authority + urld.directory;
		this.context.links = response.headers.link;
		this.context.type  = response.headers['content-type'];
	};

	ClientRegion.prototype.__handleResponse = function(e, request, response) {
		var requestTarget = this.__chooseRequestTarget(e, request);
		var targetClient = Environment.getClientRegion(requestTarget.id);
		if (targetClient)
			targetClient.__updateContext(request, response);
		CommonClient.handleResponse(requestTarget, this.element, response);
		Environment.postProcessRegion(requestTarget);
	};

	ClientRegion.prototype.__chooseRequestTarget = function(e, request) {
		if (e.target.tagName == 'OUTPUT' || (e.target.tagName == 'FORM' && e.target.dataset.output === 'true')) {
			return e.target;
		} else {
			if (this.hasRights('element targeting'))
				return document.getElementById(request.target) || this.element;
			else
				return this.element;
		}
	};

	exports.ClientRegion = ClientRegion;
})(Environment);(function(exports) {

	exports.config = {
		workerBootstrapUrl : 'lib/worker-server.min.js'
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
			Environment.numServers--;
		}
	};

	exports.getServer = function(domain) { return Environment.servers[domain]; };
	exports.listFilteredServers = function(fn) {
		var list = {};
		for (var k in Environment.servers) {
			if (fn(Environment.servers[k], k)) list[k] = Environment.servers[k];
		}
		return list;
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

	exports.removeClientRegion = function(id) {
		if (Environment.clientRegions[id]) {
			Environment.clientRegions[id].terminate();
			delete Environment.clientRegions[id];
			Environment.numClientRegions--;
		}
	};

	exports.getClientRegion = function(id) { return Environment.clientRegions[id]; };

	// dispatch monkeypatch
	// - allows the environment to control request permissions / sessions / etc
	// - adds the `origin` parameter, which is the object responsible for the request
	var envDispatchWrapper;
	var orgLinkDispatchFn = Link.dispatch;
	Link.dispatch = function(req, origin) {
		var res = envDispatchWrapper.call(this, req, origin, orgLinkDispatchFn);
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
	envDispatchWrapper = function(req, origin, dispatch) {
		return dispatch(req);
	};
	exports.setDispatchWrapper = function(fn) {
		envDispatchWrapper = fn;
	};

	// response html post-process
	// - override this to modify html after it has entered the document
	// - useful for adding environment widgets
	exports.postProcessRegion = function(elem) { return this.__postProcessRegion(elem); };
	exports.__postProcessRegion = function() {};
	exports.setRegionPostProcessor = function(fn) {
		this.__postProcessRegion = fn;
	};
})(Environment);// set up for node or AMD
if (typeof module !== "undefined") {
	module.exports = App;
}
else if (typeof define !== "undefined") {
	define([], function() {
		return App;
	});
}