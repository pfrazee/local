

var servers = {};
var numServers = 0;
function spawnServer(domain, scriptUrl) {
	var server = new Server(scriptUrl);
	servers[server.config.id] = server;
	numServers++;
	return server;
}