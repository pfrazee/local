// Helpers to create servers
// -

var localConfig = require('./config.js');
var helpers = require('./web/helpers.js');
var httpl = require('./web/httpl.js');
var WorkerBridgeServer = require('./web/worker-bridge-server.js');
var Relay = require('./web/relay.js');

// EXPORTED
// Creates a Web Worker and a bridge server to the worker
// eg `local.spawnWorkerServer('http://foo.com/myworker.js', localServerFn)
// - `src`: optional string, the URI to load into the worker. If null, must give `config.domain` with a source-path
// - `config`: optional object, additional config options to pass to the worker
// - `config.domain`: optional string, overrides the automatic domain generation
// - `config.temp`: boolean, should the workerserver be destroyed after it handles it's requests?
// - `config.shared`: boolean, should the workerserver be shared?
// - `config.namespace`: optional string, what should the shared worker be named?
//   - defaults to `config.src` if undefined
// - `config.onerror`: optional function, set to the worker's onerror callback
// - `serverFn`: optional function, a response generator for requests from the worker
function spawnWorkerServer(src, config, serverFn) {
	if (typeof config == 'function') { serverFn = config; config = null; }
	if (!config) { config = {}; }
	config.src = src;
	config.serverFn = serverFn;

	// Create the domain
	var domain = config.domain;
	if (!domain) {
		if (local.isAbsUri(src)) {
			var urld = helpers.parseUri(src);
			domain = urld.authority + '(' + urld.path.slice(1) + ')';
		} else {
			var src_parts = src.split(/[\?#]/);
			domain = window.location.host + '(' + src_parts[0].slice(1) + ')';
		}
	}
	if (httpl.getServer(domain)) throw "Worker already exists";

	// Eject a temp server if needed
    var nWorkerServers = 0, ejectCandidate = null;
    for (var d in httpl.getServers()) {
        var s = httpl.getServer(d).context;
        if (!(s instanceof WorkerBridgeServer))
            continue;
        if (!ejectCandidate && s.config.temp && !s.isInTransaction())
            ejectCandidate = s;
        nWorkerServers++;
    }
    if (nWorkerServers >= localConfig.maxActiveWorkers && ejectCandidate) {
	    console.log('Closing temporary worker', ejectCandidate.config.domain);
	    ejectCandidate.terminate();
	    httpl.removeServer(ejectCandidate.config.domain);
    }

	// Create the server
	var server = new WorkerBridgeServer(config);
	httpl.addServer(domain, server);

	return server;
}

// EXPORTED
// Opens a stream to a peer relay
// - `providerUrl`: optional string, the relay provider
// - `config.app`: optional string, the app to join as (defaults to window.location.host)
// - `serverFn`: optional function, a response generator for requests from connected peers
function joinRelay(providerUrl, config, serverFn) {
	if (typeof config == 'function') { serverFn = config; config = null; }
	if (!config) config = {};
	config.provider = providerUrl;
	config.serverFn = serverFn;
	return new Relay(config);
}
module.exports = {
	spawnWorkerServer: spawnWorkerServer,
	joinRelay: joinRelay
};