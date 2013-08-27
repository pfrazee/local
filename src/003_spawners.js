// Helpers to create servers

// - `ServerConstructor`: required function
// - `opts`: optional object, additional config to mix into the new server
local.spawnAppServer = function(ServerConstructor, opts) {
	var server = new ServerConstructor(opts);
	var domain = getAvailableLocalDomain(ServerConstructor.name.toLowerCase() + '{n}');
	local.web.registerLocal(domain, server);
	return server;
};

// - `src`: required string
// - `opts`: optional object, additional config to mix into the new server
local.spawnWorkerServer = function(src, opts) {
	if (!opts) {
		opts = {};
	}
	opts.src = src;
	var server = new local.web.WorkerServer(opts);
	// :TODO: data-uris
	var domain = getAvailableLocalDomain(src.split('/').pop().toLowerCase() + '{n}');
	local.web.registerLocal(domain, server);
	return server;
};

// - `peer`: required object, who we are connecting to (should be supplied by the peer relay)
//   - `peer.stream`: required string, the peer's stream ID
//   - `peer.user`: required string, the peer's user ID
//   - `peer.app`: required string, the peer's app domain
// - `signalStream`: required EventSource
// - `opts.initiateAs`: optional object, if specified will initiate the connection using the object given
//   - if given, should match the schema of `peer`
local.spawnRTCPeerServer = function(peer, signalStream, opts) {
	if (!opts) {
		opts = {};
	}
	opts.peer = peer;
	opts.signalStream = signalStream;
	var server = new local.web.RTCPeerServer(opts);
	var domain = getAvailableLocalDomain(peer.app.toLowerCase() + '{n}.' + peer.user.toLowerCase());
	local.web.registerLocal(domain, server);
	return server;
};

function getAvailableLocalDomain(base) {
	var i = '', str;
	do {
		str = base.replace('{n}', i);
		if (!i)
			i = 2;
		else
			i++;
	} while (local.web.getLocal(str));
	return str;
}