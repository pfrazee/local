// Helpers to create servers
// -

// EXPORTED
// Creates a Web Worker and a bridge server to the worker
// eg `local.spawnWorkerServer('http://foo.com/myworker.js', localServerFn, )
// - `src`: required string, the URI to load into the worker
// - `config`: optional object, additional config options to pass to the worker
// - `config.domain`: optional string, overrides the automatic domain generation
// - `config.shared`: boolean, should the workerserver be shared?
// - `config.namespace`: optional string, what should the shared worker be named?
//   - defaults to `config.src` if undefined
// - `config.nullify`: optional [string], a list of objects to nullify when the worker loads
//   - defaults to ['XMLHttpRequest', 'Worker', 'WebSocket', 'EventSource']
// - `config.bootstrapUrl`: optional string, specifies the URL of the worker bootstrap script
// - `serverFn`: optional function, a response generator for requests from the worker
local.spawnWorkerServer = function(src, config, serverFn) {
	if (typeof config == 'function') { serverFn = config; config = null; }
	if (!config) { config = {}; }
	config.src = src;
	config.serverFn = serverFn;

	// Create the server
	var server = new local.WorkerBridgeServer(config);

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
// - `config.app`: optional string, the app to join as (defaults to window.location.host)
// - `serverFn`: optional function, a response generator for requests from connected peers
local.joinPeerRelay = function(providerUrl, config, serverFn) {
	if (typeof config == 'function') { serverFn = config; config = null; }
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