(function(exports) {

	// AppEnvironment
	// ==============
	// manages servers and clients in the document
	function AppEnvironment() {
		this.servers    = {};
		this.clients    = {};
		this.numServers = 0;
		this.numClients = 0;
	}

	AppEnvironment.prototype.spawnServer = function(domain, scriptUrl) {
		// instantiate the application
		var server = new Server(scriptUrl);
		this.servers[server.config.id] = server;
		this.numServers++;

		// register the server
		Link.registerLocal(domain, server.requestHandler, server);

		return server;
	};

	AppEnvironment.prototype.spawnClient = function(selector) {
		var client = new Client(selector);
		this.clients[selector] = client;
		this.numClients++;
		return client;
	};

	AppEnvironment.prototype.onSessionRequest = function(handler) {
		// :TODO:
	};

	AppEnvironment.prototype.onAuthRequest = function(handler) {
		// :TODO:
	};

	exports.AppEnvironment = AppEnvironment;
})(LinkAP);