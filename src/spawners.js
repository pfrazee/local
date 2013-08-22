// Helpers to create servers

// - `ServerConstructor`: required function
// - `opts`: optional object, additional config to mix into the new server
local.spawnAppServer = function(ServerConstructor, opts) {
	var server = new ServerConstructor(opts);
	var domain = getAvailableLocalDomain(ServerConstructor.name.toLowerCase() + '{n}');
	local.web.registerLocal(domain, server);
};

// - `src`: required string
// - `opts`: optional object, additional config to mix into the new server
local.spawnWorkerServer = function(src, opts) {
	if (!opts)
		opts = {};
	opts.src = src;
	var server = new local.web.WorkerServer(opts);
	var domain = getAvailableLocalDomain(src.split('/').pop().toLowerCase() + '{n}');
	local.web.registerLocal(domain, server);
};

local.spawnRTCPeerServer = function() {
	// :TODO:
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