(function(exports) {

	// Environment
	// ===========
	// manages servers and clients in the document
	function Environment() {
		this.servers    = {};
		this.clients    = {};
		this.numServers = 0;
		this.numClients = 0;
	}

	Environment.prototype.addServer = function(domain, server) {
		// instantiate the application
		server.environment = this;
		server.config.domain = domain;
		this.servers[server.config.id] = server;
		this.numServers++;

		// register the server
		Link.registerLocal(domain, server.handleHttpRequest, server);

		return server;
	};

	Environment.prototype.addClient = function(selector) {
		var client = new App.Client(selector);
		this.clients[selector] = client;
		this.numClients++;
		return client;
	};

	// request wrapper
	// - used by all WorkerServers, may be used elsewhere as desired
	// - override this to control request permissions / sessions / etc
	Environment.prototype.request = function(origin, request) {
		return Link.request(request);
	};

	exports.Environment = Environment;
})(App);