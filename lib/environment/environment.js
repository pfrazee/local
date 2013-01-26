(function(exports) {

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