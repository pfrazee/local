(function(exports) {

	exports.servers = {};
	exports.clientRegions = {};
	exports.numServers = 0;
	exports.numClientRegions = 0;

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

	exports.addClientRegion = function(id) {
		var clientRegion = new Environment.ClientRegion(id);
		Environment.clientRegions[id] = clientRegion;
		Environment.numClientRegions++;
		return clientRegion;
	};

	exports.getClientRegion = function(id) {
		return Environment.clientRegions[id];
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