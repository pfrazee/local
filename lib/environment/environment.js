(function(exports) {

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

	// response html post-process
	// - override this to modify html after it has entered the document
	// - useful for adding environment widgets
	exports.postProcessRegion = function() {};
})(Environment);