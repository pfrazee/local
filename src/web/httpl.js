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

	// Helper to lookup the handler from the current env's routes
	var lookupRoute = function() {
		var pathd;
		for (var i=0; i < _routes.length; i++) {
			pathd = _routes[i].path.exec(oreq.headers.path);
			if (pathd) {
				oreq.headers.pathd = pathd; // update request headers to include the path match
				return _routes[i].handler;
			}
		}
	};

	// Get the handler
	var handler;
	var isInWorker = (typeof self.document == 'undefined');
	var isNonLocal = (oreq.urld.authority || oreq.urld.path);
	// Is a host URL given?
	if (isInWorker) {
		if (oreq.urld.authority == 'self') {
			// http://self#foo
			// Match the route in the current worker
			handler = lookupRoute();
		} else {
			// Use the page
			handler = self.pageBridge.onRequest.bind(self.pageBridge);

			// Use the special #pubweb_proxy handler for non-local requests
			if (isNonLocal) {
				// build new combined query params
				var queryParams = contentTypes.serialize('application/x-www-form-urlencoded', oreq.headers.params);
				if (queryParams && oreq.urld.query) { queryParams += '&'; }
				queryParams += oreq.urld.query;

				// prep new request
				oreq.headers.path = '#pubweb_proxy';
				oreq.headers.params = {
					url: ((oreq.urld.protocol) ? oreq.urld.protocol + '://' : '') +
						(oreq.urld.authority||'') +
						oreq.urld.path +
						((queryParams) ? '?' + queryParams : '') +
						((oreq.headers.url.indexOf('#') !== -1) ? '#' + oreq.urld.anchor : '')
				};
			}
		}
	} else if (isNonLocal) {
		if (oreq.urld.authority == 'page') {
			// http://page#foo
			// Match the route in the current page
			handler = lookupRoute();
		} else {
			// http://bar.com/foo.js#
			// Try to get/load the VM
			handler = workers.getWorker(oreq.urld);
		}
	} else {
		// Match the route in the current page
		handler = lookupRoute();
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
		handler(ireq, ores, oreq.originChannel);
	} else {
		ores.status(404, 'Not Found').end();
	}
});

module.exports = {
	at: at,
	getRoutes: getRoutes
};