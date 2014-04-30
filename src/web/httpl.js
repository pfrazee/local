var helpers = require('./helpers.js');
var schemes = require('./schemes.js');
var contentTypes = require('./content-types.js');
var IncomingRequest = require('./incoming-request.js');
var Response = require('./response.js');

// Local Routes Registry
// =====================
var _routes = [];

// EXPORTED
function at(pathOrRegex, handler) {
	if (typeof pathOrRegex == 'string') {
		pathOrRegex = new RegExp('^('+pathOrRegex+')$', 'i');
	}

	_routes.push({ path: pathOrRegex, handler: handler });
}

// EXPORTED
function getRoutes() {
	return _routes;
}

// Virtual request handler
schemes.register('#', function (oreq, ires) {
	// Parse the virtual path
	var urld2 = local.parseUri('/' + (oreq.urld.anchor || ''));
	if (urld2.query) {
		// mix query params into request
		var queryParams = local.contentTypes.deserialize('application/x-www-form-urlencoded', urld2.query);
		oreq.param(queryParams);
	}
	oreq.path = '#' + urld2.path.slice(1);

	// Match the route
	var pathd, handler;
	for (var i=0; i < _routes.length; i++) {
		pathd = _routes[i].path.exec(oreq.path);
		if (pathd) {
			handler = _routes[i].handler;
			break;
		}
	}
	// :TODO: equivalent
	// 	if (req.urld.srcPath) {
	// 		// Try to load worker to handle response
	// 		console.log('Spawning temporary worker', req.urld.authority);
	// 		return require('../spawners.js').spawnWorkerServer(null, { domain: req.urld.authority, temp: true });
	// 	}
	oreq.pathd = pathd;

	// Create incoming request / outgoing response
	var ireq = new IncomingRequest(oreq.headers);
	var ores = new Response();

	// Wire up events
	oreq.wireUp(ireq, true);
	ores.wireUp(ires, true);

	// Support warnings
	if (oreq.isBinary) // :TODO: add support
		console.warn('Got virtual request with binary=true - sorry, not currently supported', oreq);

	// Pass on to the handler
	if (handler) {
		handler(ireq, ores);
	} else {
		ores.s404().end();
	}
});

module.exports = {
	at: at,
	getRoutes: getRoutes
};