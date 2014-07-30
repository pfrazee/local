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
	this.routes  = undefined;
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
Server.prototype.close = function(status, reason) {
	if (this.address) {
		delete _servers[this.address.local];
		this.address = null;
		if (this.bridge) {
			this.bridge.terminate(status, reason);
			delete this.bridge;
		}
	}
};

// EXPORTED
Server.prototype.on = function(method, path, handler) {
	if (this.handler && !this.routes) {
		throw "Can not use routing functions and provide a handler function to createServer()";
	}
	if (!this.routes) {
		this.routes = [];
		this.handler = routesHandler;
	}

	// Extract the tokens in their positions within the regex match (less 1, because we drop the first value in the match array)
	var pathTokens = {};
	var i=0, match, re = /(:([^\/]*))|\(.+\)/g;
	// note, we match both /:tokens and /(regex_groups), but we're only going to note the positions of the /:tokens
	// this is because both produce items in an exec() response array, and we need to have the correct positioning for the /:tokens
	while ((match = re.exec(path))) {
		if (match[0].charAt(0) == ':') { // token or just a regex group?
			pathTokens[i] = match[2]; // map the position to the token name
		}
		i++;
	}

	// Replace tokens with standard path part groups
	path = path.replace(/(:[^\/]*)/g, '([^/]*)');

	// Store
	var regex = new RegExp('^'+path+'$', 'i');
	this.routes.push({ method: method.toUpperCase(), path: path, regex: regex, pathTokens: pathTokens, handler: handler });
};

// Route sugars
// EXPORTED
Server.prototype.all = function(path, handler) {
	this.on('*', path, handler);
};
['HEAD', 'GET', 'POST', 'PUT', 'DELETE', 'SUBSCRIBE', 'NOTIFY'].forEach(function(method) {
	Server.prototype[method.toLowerCase()] = function(path, handler) {
		this.on(method, path, handler);
	};
});

// INTERNAL
// handler used to handle Server routes
function routesHandler(req, res) {
	// Match route
	var routeMatched = false, allowMethods = {}, route, match;
	for (var i=0; i < this.routes.length; i++) {
		var r = this.routes[i];
		match = r.regex.exec(req.path);
		if (!match) {
			continue;
		}
		routeMatched = true;

		// It would be faster to check method first, but checking method second lets us distinguish between 405 and 404
		if (r.method != '*' && r.method != req.method) {
			allowMethods[r.method] = 1;
			continue;
		}

		route = r;
		break;
	}

	// Handle nomatch
	if (!route) {
		if (routeMatched) {
			res.s405('Bad method');
			allowMethods = Object.keys(allowMethods).join(', ');
			if (allowMethods) res.allow(allowMethods);
			res.end();
		} else {
			res.s404('Not found').end();
		}
		return;
	}

	// Add path matches to params
	for (var i=1; i < match.length; i++) {
		req.params[i-1] = match[i];
	}

	// Add tokens to params
	for (var k in r.pathTokens) {
		req.params[r.pathTokens[k]] = req.params[k];
	}

	// Run handler
	route.handler(req, res);
}

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