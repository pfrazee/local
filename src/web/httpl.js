var schemes = require('./schemes.js');
var helpers = require('./helpers.js');
var contentTypes = require('./content-types.js');

// HTTPL
// =====
schemes.register(['local', 'httpl'], function(request, response) {
	// Find the local server
	var server = getServer(request.urld.authority);
	if (!server) {
		server = hostLookupFn(request, response);
		if (!server)
			server = localNotFoundServer;
	}

	// Deserialize the headers
	request.deserializeHeaders();

	// Pull out and standardize the path & host
	request.path = request.urld.path;
	request.headers.host = request.urld.authority;
	if (!request.path) request.path = '/'; // no path, give a '/'
	else request.path = request.path.replace(/(.)\/$/, '$1'); // otherwise, never end with a '/'

	// Pull out any query params in the path
	if (request.urld.query) {
		var query = contentTypes.deserialize('application/x-www-form-urlencoded', request.urld.query);
		if (!request.query) { request.query = {}; }
		for (var k in query) {
			request.query[k] = query[k];
		}
	}

	// Support warnings
	if (request.binary)
		console.warn('Got HTTPL request with binary=true - sorry, not currently supported', request);

	// Pass on to the server
	if (server.fn) {
		server.fn.call(server.context, request, response);
	} else if (server.handleLocalRequest) {
		server.handleLocalRequest(request, response);
	} else if (typeof server == 'function') {
		server(request, response);
	} else {
		throw "Invalid server";
	}
});

// EXPORTED
function setHostLookup(fn) {
	hostLookupFn = fn;
}

setHostLookup(function(req, res) {
	if (req.urld.srcPath) {
		// Try to load worker to handle response
		console.log('Spawning temporary worker', req.urld.authority);
		return require('../spawners.js').spawnWorkerServer(null, { domain: req.urld.authority, temp: true });
	}

	return false;
});

// Local Server Registry
// =====================
var __httpl_registry = {};

// EXPORTED
function addServer(domain, server, serverContext) {
	if (__httpl_registry[domain]) throw new Error("server already registered at domain given to addServer");

	var isServerObj = (server instanceof Server);
	if (isServerObj) {
		serverContext = server;
		server = server.handleLocalRequest;
		serverContext.config.domain = domain;
	}

	__httpl_registry[domain] = { fn: server, context: serverContext };
	return __httpl_registry[domain];
}

// EXPORTED
function removeServer(domain) {
	if (__httpl_registry[domain]) {
		delete __httpl_registry[domain];
	}
}

// EXPORTED
function getServer(domain) {
	return __httpl_registry[domain];
}

// EXPORTED
function getServers() {
	return __httpl_registry;
}


module.exports = {
	addServer: addServer,
	removeServer: removeServer,
	getServer: getServer,
	getServers: getServers,

	setHostLookup: setHostLookup
};