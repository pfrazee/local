var helpers = require('./helpers');
var schemes = require('./schemes');
var contentTypes = require('./content-types');
var IncomingRequest = require('./incoming-request');
var Response = require('./response');
var Bridge = require('./bridge');

// Server
// ======
var _servers = {};
function Server(handler, channel) {
	this.handler = handler;
	this.channel = channel;
	this.bridge  = undefined;
	this.address = undefined;
	this.targetOrigin = undefined;
}

// EXPORTED
// starts handling requests at the given address
// - `opts.local`: string, the local address
// - `opts.targetOrigin`: string, the target origin of the bridge (if applicable). Defaults to '*'
// - currently only supports local addresses
Server.prototype.listen = function(opts) {
	opts = opts || {};
	if (!opts.local) {
		throw "Currently only local:// addresses are supported by listen() in localjs (eg local://my-domain)";
	}
	if (this.address) {
		throw "Already listening - must close() before calling listen() again";
	}
	if (opts.local in _servers) {
		throw "Address '"+opts.local+"' is already in use";
	}

	// Setup and add to registry
	this.address = { local: opts.local };
	if (this.channel) {
		this.bridge = new Bridge(opts.local, this.channel, this.handler, opts.targetOrigin);
	}
	_servers[opts.local] = this;
};

// EXPORTED
function createServer(channel, handler) {
	// Deal with createServer(handler)
	if (!handler && typeof channel == 'function') {
		handler = channel;
		channel = void 0;
	}
	return new Server(handler, channel);
}

// EXPORTED
function getLocalServers() {
	return _servers;
}

// EXPORTED
function getLocalServer(address) {
	return _servers[address];
}

// EXPORTED
function allocName(base) {
	if (!base) base = 'server';
	for (var i=0; i < 10000; i++) {
		var name = base + i;
		if (!(name in _servers)) {
			return name;
		}
	}
}

// Local-server request handler
// ============================
schemes.register('local', function (oreq, ires) {
	if (oreq.urld.query) {
		// Mix query params into request
		var queryParams = contentTypes.deserialize('application/x-www-form-urlencoded', oreq.urld.query);
		oreq.param(queryParams);
	}

	// Create incoming request / outgoing response
	oreq.headers.path = oreq.urld.path;
	var ireq = new IncomingRequest(oreq.headers);
	var ores = new Response();

	// Wire up events
	oreq.wireUp(ireq);
	ores.wireUp(ires);
	ireq.memoEventsTillNextTick();
	ires.memoEventsTillNextTick();
	oreq.on('close', function() { ores.close(); });

	// Support warnings
	if (oreq.isBinary) // :TODO: add support
		console.warn('Got virtual request with binary=true - sorry, not currently supported', oreq);

	// Pass on to the server
	var server = _servers[oreq.urld.authority];
	if (server) {
		if (server.bridge) {
			server.bridge.handleLocalRequest(ireq, ores);
		} else {
			server.handler(ireq, ores);
		}
	} else {
		ores.status(404, 'Not Found').end();
	}
});

module.exports = {
	createServer: createServer,
	getLocalServers: getLocalServers,
	getLocalServer: getLocalServer,
	allocName: allocName
};