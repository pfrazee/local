// Router
// ======
// extends linkjs
// pfraze 2012

(function (exports) {
	// router sugar functions
	// ======================
	// this structure is used to build the various forms of the route function
	// - creates all possible combinations while maintaining order
	var ROUTER_FNS = ['p','pm','pma','pmat', 'pmta', 'pmt','pa','pt','m','ma','mat', 'mta', 'mt', 'mp', 'mpa', 'mpt', 'mpat', 'mpta', 'a','at','t'];
	var ROUTER_FNS_SELECTOR_MAP = {
		p:'path',
		m:'method',
		a:'accept',
		t:'content-type'
	};

	// definitions/helpers about the composition of the request object
	var nonheaders = ['path','method','query','body','stream'];
	function isHeader(key) {
		return (nonheaders.indexOf(key) === -1);
	}
	function getRequestValue(request, key) {
		if (isHeader(key)) {
			if (request.headers) {
				return request.headers[key];
			}
			return null;
		}
		return request[key];
	}

	// array helper
	function has(arr, v) { return (arr.indexOf(v) !== -1); }

	function convertSelectorToRegexp(selector) {
		if (selector instanceof RegExp) { return selector; }
		// arrays are ORed together (`['a','b','c']`->`/a|b|c/`)
		if (Array.isArray(selector)) { return new RegExp('^'+selector.join('|')+'$', 'gi'); }
		return new RegExp('^'+selector+'$', 'gi');
	}

	// Router
	// ======
	// a message -> behavior routing helper for servers
	// - `request` should be the `request` param of the server's request handler fn
	function Router(request) {
		this.request   = request;
		this.isRouted  = false; // has one of the routes hit yet?
		this.bestMatch = []; // a set of parameters which were hit during our closest match
	}

	// calls the given cb if the request matches the given selectors
	Router.prototype.route = function(selectors, cb) {
		// sanity check
		if (typeof cb !== 'function') {
			throw new Error('a handler callback must be given to the route');
		}

		if (this.isRouted) { return this; } // no more routing

		// test the request against selectors
		var m, v, selector;
		var matchedResults = {}, matchedKeys = [];
		var isMatch = true;
		for (var key in selectors) {
			// extract testing data
			selector = selectors[key];
			v = getRequestValue(this.request, key);

			// make sure all paths start with a /
			if (key == 'path' && v.charAt(0) != '/') {
				v = '/' + v;
			}

			// run test
			m = selector.exec(v);

			if (m !== null && m !== false) { // match
				matchedResults[key] = m;
				matchedKeys.push(key);
			} else { // miss
				isMatch = false;
				// best match is the match the most valid keys
				// - gives preference to path and method hits
				// :NOTE: child matches (that is, matches made in the callback) do not currently include the parent's bestMatch
				if ((has(matchedKeys, 'path') || has(matchedKeys, 'method')) && matchedKeys.length > this.bestMatch.length) {
					this.bestMatch = matchedKeys;
				}
			}
		}

		if (isMatch) {
			// successful match, run the callback
			cb.call(this, matchedResults);
			this.isRouted = true;
		}
		
		return this;
	};

	// error-response generator
	// - uses the partial match history to construct an intelligent response (eg if a url hit once, it's not a 404)
	// - should be called at the end of a routing structure
	// - add parameter names to `ignores` to assume those parameters did match
	//   (corrects sub-routing error-reporting, where parent matches to the callback are not included)
	Router.prototype.error = function(response, ignores) {
		if (this.isRouted) { return this; }
		var respond = Link.responder(response);
		var bestMatch = this.bestMatch.concat(ignores);
		if      (!has(bestMatch, 'path')) { respond.notFound().end(); }
		else if (!has(bestMatch, 'method')) { respond.methodNotAllowed().end(); }
		else if (!has(bestMatch, 'content-type') && this.request.body ) { respond.unsupportedMediaType().end(); }
		else if (!has(bestMatch, 'accept') && this.request.headers.accept) { respond.notAcceptable().end(); }
		else    { respond.badRequest().end(); }
	};

	// add router sugars
	ROUTER_FNS.forEach(function addRouterFn(fnName) {
		// build an array of selector names
		// eg 'rma' -> `['url','method','accept']`
		var selectors = fnName.split('').map(function(abbrev) { return ROUTER_FNS_SELECTOR_MAP[abbrev]; });
		// add function
		Router.prototype[fnName] = function() {
			// build the `route` call out of the function name by mapping the parameters to a selector object
			// eg `rma = function(url, method, accept, cb)` -> `route({ url:arg0, method:arg1, accept:arg2 }, arg3)`
			var selectorStructure = {};
			var argIndex=0;
			for (argIndex; argIndex < selectors.length; argIndex++) {
				var selector = selectors[argIndex];
				selectorStructure[selector] = convertSelectorToRegexp(arguments[argIndex]);
			}
			var cb = arguments[argIndex];
			return this.route(selectorStructure, cb);
		};
	});

	// adds a type alias for use in the responder functions
	// - eg html -> text/html
	Router.setTypeAlias = function(alias, mimetype) {
		typeAliases[alias] = mimetype;
	};

	// wrap helper
	function router(request) {
		return (request instanceof Router) ? request : new Router(request);
	}

	exports.Router = Router;
	exports.router = router;
})(Link);