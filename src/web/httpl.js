var helpers = require('./helpers.js');
var schemes = require('./schemes.js');
var contentTypes = require('./content-types.js');
var IncomingRequest = require('./incoming-request.js');
var Response = require('./response.js');
var workers = require('./workers.js');

// Local Routes Registry
// =====================
var _routes = [];

// EXPORTED
function at(path, handler) {
	if (path.charAt(0) != '#') {
		path = '#' + path;
	}
	path = new RegExp('^('+path+')$', 'i');
	_routes.push({ path: path, handler: handler });
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
	oreq.headers.path = '#' + urld2.path.slice(1);

	// Get the handler
	var handler;
	// Is a host URL given?
	if (oreq.urld.path) {
		// Try to get/load the VM
		handler = workers.getWorker(oreq.urld);
	} else {
		// Match the route in the current page
		var pathd;
		for (var i=0; i < _routes.length; i++) {
			pathd = _routes[i].path.exec(oreq.headers.path);
			if (pathd) {
				handler = _routes[i].handler;
				break;
			}
		}
		oreq.headers.pathd = pathd;
	}

	// Create incoming request / outgoing response
	var ireq = new IncomingRequest(oreq.headers);
	var ores = new Response();

	// Wire up events
	oreq.wireUp(ireq);
	ores.wireUp(ires);
    ireq.memoEventsTillNextTick();
    ires.memoEventsTillNextTick();

	// Support warnings
	if (oreq.isBinary) // :TODO: add support
		console.warn('Got virtual request with binary=true - sorry, not currently supported', oreq);

	// Pass on to the handler
	if (handler) {
		handler(ireq, ores, oreq.originChannel);
	} else {
		ores.s404().end();
	}
});

module.exports = {
	at: at,
	getRoutes: getRoutes
};