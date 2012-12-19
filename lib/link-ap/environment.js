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

	Environment.prototype.spawnServer = function(domain, scriptUrl) {
		// instantiate the application
		var server = new App.Server(scriptUrl);
		this.servers[server.config.id] = server;
		this.numServers++;

		// register the server
		Link.registerLocal(domain, server.postHttpRequestMessage, server);

		return server;
	};

	Environment.prototype.spawnClient = function(selector) {
		var client = new App.Client(selector);
		this.clients[selector] = client;
		this.numClients++;
		return client;
	};

	Environment.prototype.onSessionRequest = function(handler) {
		// :TODO:
	};

	Environment.prototype.onAuthRequest = function(handler) {
		// :TODO:
	};

	exports.Environment = Environment;
})(App);