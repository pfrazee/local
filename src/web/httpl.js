var schemes = require('./schemes.js');
var helpers = require('./helpers.js');
var contentTypes = require('./content-types.js');
var Server = require('./server.js');

// HTTPL
// =====
var hostLookupFn;
var localNotFoundServer = function(request, response) {
	response.writeHead(404, 'server not found');
	response.end();
};
var localRelayNotOnlineServer = function(request, response) {
	response.writeHead(407, 'peer relay not authenticated');
	response.end();
};
schemes.register('httpl', function(request, response) {
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
		var src_url = helpers.joinUri(req.urld.host, req.urld.srcPath);
		var full_src_url = 'https://'+src_url;

		// Return a server function which attempts to load the service first
		return function() {

			// :TODO: due to a bug in firefox, Workers created by Blobs don't work with a CSP script directive set
			// https://bugzilla.mozilla.org/show_bug.cgi?id=964276
			// this means we have to load via a url, so we have to do a HEAD then GET instead of one GET
			local.HEAD(full_src_url)
				.fail(function(res2) {
					if (res2.status === 0 || res2.status == 404) {
						// Not found? Try again without ssl
						full_src_url = 'http://'+src_url;
						return local.HEAD(full_src_url);
					}
					throw res2;
				})
				.then(function(res2) {
					// :TODO: check self link and act on reltype - assuming worker script for now
					var server = require('../spawners.js').spawnWorkerServer(full_src_url);
					server.handleLocalRequest(req, res);
				});
		};
	}

	// Check if this is a peerweb URI
	var peerd = helpers.parsePeerDomain(req.urld.authority);
	if (peerd) {
		// See if this is a default stream miss
		if (peerd.sid == 0) {
			if (req.urld.authority.slice(-2) == '!0') {
				server = getServer(req.urld.authority.slice(0,-2));
			} else {
				req.urld.authority += '!0';
				server = getServer(req.urld.authority);
			}
		}
		if (!server) {
			// Not a default stream miss
			if (peerd.relay in __peer_relay_registry) {
				// Try connecting to the peer
				__peer_relay_registry[peerd.relay].connect(req.urld.authority);
				return getServer(req.urld.authority);
			} else {
				// We're not connected to the relay
				return localRelayNotOnlineServer;
			}
		}
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


// Local Relay Registry
// ====================
var __peer_relay_registry = {};

// EXPORTED
function addRelay(domain, relay) {
	__peer_relay_registry[domain] = relay;
}

// EXPORTED
function removeRelay(domain) {
	if (__peer_relay_registry[domain]) {
		delete __peer_relay_registry[domain];
	}
}

// EXPORTED
function getRelay(domain) {
	return __peer_relay_registry[domain];
}

// EXPORTED
function getRelays() {
	return __peer_relay_registry;
}

module.exports = {
	addServer: addServer,
	removeServer: removeServer,
	getServer: getServer,
	getServers: getServers,

	addRelay: addRelay,
	removeRelay: removeRelay,
	getRelay: getRelay,
	getRelays: getRelays,

	setHostLookup: setHostLookup
};