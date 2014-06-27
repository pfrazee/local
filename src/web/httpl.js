var helpers = require('./helpers');
var schemes = require('./schemes');
var contentTypes = require('./content-types');
var IncomingRequest = require('./incoming-request');
var Response = require('./response');
var Bridge = require('./bridge');

// Local Routes Registry
// =====================
var _routes = [];

// EXPORTED
function at(path, handler, targetOrigin) {
	// Bridge as needed
	if (typeof handler != 'function' && !handler.bridge) {
		var channel = handler;
		channel.bridge = new Bridge(path, channel, targetOrigin);
		path += '(/.*)?';
		handler = channel.bridge;
	}

	// Add route
	if (path.charAt(0) != '#') {
		path = '#' + path;
	}
	path = new RegExp('^'+path+'$', 'i');
	_routes.push({ path: path, handler: handler });
}

// EXPORTED
function getRoutes() {
	return _routes;
}

// Virtual request handler
schemes.register('#', function (oreq, ires) {
	// Parse the virtual path
	var urld2 = helpers.parseUri('/' + (oreq.urld.anchor || ''));
	if (urld2.query) {
		// mix query params into request
		var queryParams = contentTypes.deserialize('application/x-www-form-urlencoded', urld2.query);
		oreq.param(queryParams);
	}
	oreq.headers.path = '#' + urld2.path.slice(1);

	// Get the handler
	var pathd, handler;
	for (var i=0; i < _routes.length; i++) {
		pathd = _routes[i].path.exec(oreq.headers.path);
		if (pathd) {
			oreq.headers.pathd = pathd; // update request headers to include the path match
			handler = _routes[i].handler;
		}
	}

	// Create incoming request / outgoing response
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

	// Pass on to the handler
	if (handler) {
		if (handler instanceof Bridge) {
			handler.onRequest(ireq, ores, oreq.originChannel);
		} else {
			handler(ireq, ores, oreq.originChannel);
		}
	} else {
		ores.status(404, 'Not Found').end();
	}
});

module.exports = {
	at: at,
	getRoutes: getRoutes
};