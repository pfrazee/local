// Helpers to create servers
// -

// EXPORTED
// Creates a local server with the given constructor function
// eg `local.spawnAppServer(MyServerConstructor, { myOption: 'foobar' });`
// - `ServerConstructor`: required function
// - `config`: optional object, config options to pass to the constructor
// - `config.domain`: optional string, overrides the automatic domain generation
local.spawnAppServer = function(ServerConstructor, config) {
	if (!config) { config = {}; }
	var server = new ServerConstructor(config);
	var domain = config.domain || getAvailableLocalDomain(ServerConstructor.name.toLowerCase() + '{n}');
	local.registerLocal(domain, server);
	return server;
};

// EXPORTED
// Creates a Web Worker and a bridge server to the worker
// eg `local.spawnWorkerServer('http://foo.com/myworker.js', localServerFn, )
// - `src`: required string, the URI to load into the worker
// - `serverFn`: required function, a response generator for requests from the worker
// - `config`: optional object, additional config options to pass to the worker
// - `config.domain`: optional string, overrides the automatic domain generation
// - `config.shared`: boolean, should the workerserver be shared?
// - `config.namespace`: optional string, what should the shared worker be named?
//   - defaults to `config.src` if undefined
// - `config.nullify`: optional [string], a list of objects to nullify when the worker loads
//   - defaults to ['XMLHttpRequest', 'Worker', 'WebSocket', 'EventSource']
// - `config.bootstrapUrl`: optional string, specifies the URL of the worker bootstrap script
local.spawnWorkerServer = function(src, serverFn, config) {
	if (!config) { config = {}; }
	config.src = src;

	// Create the server
	var server = new local.WorkerBridgeServer(config);
	server.handleRemoteWebRequest = serverFn;

	// Find an open domain and register
	var domain = config.domain;
	if (!domain) {
		if (src.indexOf('data:') === 0) {
			domain = getAvailableLocalDomain('worker{n}');
		} else {
			domain = getAvailableLocalDomain(src.split('/').pop().toLowerCase() + '{n}');
		}
	}
	local.registerLocal(domain, server);

	return server;
};

// EXPORTED
// Opens a stream to a peer relay
// - `providerUrl`: required string, the relay provider
// - `serverFn`: required function, a response generator for requests from connected peers
// - `config.app`: optional string, the app to join as (defaults to window.location.host)
local.joinPeerRelay = function(providerUrl, serverFn, config) {
	if (!config) config = {};
	config.provider = providerUrl;
	config.serverFn = serverFn;
	return new local.PeerWebRelay(config);
};

// helper for name assignment
function getAvailableLocalDomain(base) {
	var i = '', str;
	do {
		str = base.replace('{n}', i);
		i = (!i) ? 2 : i + 1;
	} while (local.getLocal(str));
	return str;
}