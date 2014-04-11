// Server
// ======
// EXPORTED
// core type for all servers
// - should be used as a prototype
function Server(config) {
	this.config = { domain: null, log: false };
	if (config) {
		for (var k in config)
			this.config[k] = config[k];
	}
}
module.exports = Server;

Server.prototype.getDomain = function() { return this.config.domain; };
Server.prototype.getUrl = function() { return 'local://' + this.config.domain; };

Server.prototype.debugLog = function() {
	if (!this.config.log) return;
	var args = [this.config.domain].concat([].slice.call(arguments));
	console.debug.apply(console, args);
};

// Local request handler
// - should be overridden
Server.prototype.handleLocalRequest = function(request, response) {
	console.warn('handleLocalRequest not defined', this);
	response.writeHead(501, 'server not implemented');
	response.end();
};

// Called before server destruction
// - may be overridden
// - executes syncronously; does not wait for cleanup to finish
Server.prototype.terminate = function() {
};
