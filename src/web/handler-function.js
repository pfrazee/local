var util = require('../util');
var promises = require('../promises');
var helpers = require('./helpers');
var contentTypes = require('./content-types');
var restmpls = require('./response-templates');
var httpl = require('./httpl');

// Handler fn mixin
var handlerDef = {
	__is_handler__: true, // is handler flag
	__is_dynamic__: null, // handler function has a '$' token, indicating a subpath which is an {id}
	__parent_handler__: null, // for link construction
	__self_link__: null, // for link construction

	// standard functions:
	opts: handler_opts,
	link: handler_link,
	method: handler_method,
	header: handler_header
};

// Header sugars
[ 'Accept', 'Allow', 'ContentType', 'Location', 'Pragma' ].forEach(function(k) {
	handlerDef[k] = function(v) {
		return this.header(k, v);
	};
});

// EXPORTED
// decorates a given function to behave as a request-handler
// - `fn`: function(req, res, worker), handler function
// - `path`: optional string, the handler's path (defaults to using the fn's name)
function handler_export(fn, path) {
	// Generate path
	var isDynamic = false;
	if (!path) {
		// Pull function name
		path = util.getFnName(fn).trim();
		if (!path) throw "Could not extract a name from given export: is it a named function?";
		isDynamic = path.indexOf('$') != -1;
	}
	if (path == 'main') {
		path = '#';
	}
	if (path.charAt(0) != '#') {
		path = '#' + path;
	}

	// Decorate
	decorateHandler(fn);
	// handler attributes:
	fn.path = path.replace(/\$/g, '/{id}');
	fn.__methods__ = [];
	fn.__links__ = [];
	fn.__is_dynamic__ = isDynamic;
	if (isDynamic) {
		// atId() gives the solid path at the given id (replacing {id})
		fn.atId = handler_atId;
	}

	// Add function
	httpl.at(path.replace(/\$/g, '/(.*)'), runHandler(fn));
}

// INTERNAL
// sets up a handler function, used in .export() and .method()
function decorateHandler(fn) {
	util.mixin.call(fn, handlerDef);
	fn.__handler_opts__ = {};
	fn.__headers__ = {};
}

// sets handler options
// - `opts.stream`: bool, if true will not buffer the request body and will ignore the function response
function handler_opts(opts) {
	for (var k in opts) {
		this.__handler_opts__[k] = opts[k];
	}
}

// adds a link to the response
// - params are same as req/res.link()
function handler_link(href, attrs) {
	this.__links__.push([href, attrs || {}]);

	// establish relationships for auto-creation of related links
	if (typeof href == 'function') {
		if (href == this) {
			this.__self_link__ = attrs;
		} else if (href != this.__parent_handler__) {
			href.__parent_handler__ = this;
			href.link(href, attrs); // link to itself
			href.link(this, this.__self_link__); // link up to this
		}
	}
}

// adds a handler for the given method
// - `fn`: function(req, res, worker), handler function
// - `verb`: optional string, the method-name of the handler (defaults to using the initial uppercase letters from the handler's name)
function handler_method(fn, verb) {
	if (!verb) {
		// Pull function name
		verb = util.getFnName(fn).trim();
		if (!verb) throw "Could not extract a name from given handler: is it a named function?";

		// Use only uppercase letters at the beginning
		verb = verb.match(/^([A-Z])+/);
		if (!verb) throw "Could not extract a method from given handler: does it start with the verb in all caps? eg POST or POST_foo";
		verb = verb[0];
	}

	decorateHandler(fn);
	this.__methods__[verb.toUpperCase()] = fn;
}

// sets a persistent header
function handler_header(k, v) {
	k = helpers.formatHeaderKey(k);
	// Convert mime if needed
	if (k == 'Accept' || k == 'ContentType') {
		v = contentTypes.lookup(v);
	}
	this.__headers__[k] = v;
}

// generates a full path for a dynamic handler
// - `id`: string, the id to use
function handler_atId(id) {
	return this.path.replace('{id}', id);
}

// INTERNAL
// wraps the handler function with special logic, as is needed
function runHandler(handler) {
	return function(req, res, worker) {
		// Find handler by method
		var fn;
		if (req.method == 'HEAD' || req.method == 'GET')
			fn = handler;
		else {
			fn = handler.__methods__[req.method];
			if (!fn) {
				res.status(405, 'Method Not Allowed')
					.Allow(['HEAD', 'GET'].concat(Object.keys(handler.__methods__)).join(', '))
					.end();
				return;
			}
		}

		// Populate response headers
		for (var k in fn.__headers__) {
			res.header(k, fn.__headers__[k]);
		}

		// Links
		for (var i=0; i < handler.__links__.length; i++) {
			var link = handler.__links__[i];
			var href = link[0];
			var attrs = link[1];

			// Auto-relations
			if (href == handler) {
				// Self link
				attrs = (attrs) ? util.deepClone(attrs) : {};
				attrs.rel = 'self ' + (attrs.rel||'');
				if (handler.__is_dynamic__) {
					href = req.path;
				}
			} else if (href == handler.__parent_handler__) {
				// Up link
				attrs = (attrs) ? util.deepClone(attrs) : {};
				attrs.rel = 'up ' + (attrs.rel||'');
			}
			res.link(href, attrs);
		}

		// Type negotation
		if (fn.__headers__.Accept) {
			if (req.ContentType != fn.__headers__.Accept) {
				res.status(415, 'Unsupported Media Type').end();
				return;
			}
		}
		if (fn.__headers__.ContentType && req.Accept) {
			if (!helpers.preferredType(req.Accept, fn.__headers__.ContentType)) {
				res.status(406, 'Not Acceptable').end();
				return;
			}
		}

		// Run by options
		if (fn.__handler_opts__.stream) {
			// No special handling
			if (handler.__is_dynamic__) fn(req.pathd[1], req, res, worker);
			else                        fn(req, res, worker);
		} else {
			// Wait for body
			req.buffer(function() {
				// Act on return type
				try {
					var ret;
					if (handler.__is_dynamic__) ret = fn(req.pathd[1], req, res, worker);
					else                        ret = fn(req, res, worker);
					if (promises.isPromiselike(ret)) {
						ret.then(buildRes.bind(null, req, res), buildFailRes.bind(null, req, res));
					} else {
						buildRes(req, res, ret);
					}
				}
				catch (e) { buildFailRes(req, res, e); }
			});
		}
	};
}
function buildRes(req, res, ret) {
	if (ret === void 0) {
		ret = restmpls.NoContent();
	} else if (ret.pipe) {
		return ret.pipe(res);
	} else if (!(ret instanceof restmpls.ResponseTemplate)) {
		ret = restmpls.Ok({ body: ret });
	}
	ret.writeout(req, res);
}
function buildFailRes(req, res, err) {
	if (!err) err = '';
	if (err.pipe) {
		return err.pipe(res);
	} else if (!(err instanceof restmpls.ResponseTemplate)) {
		var errString = err.message || err.toString();
		if (errString == '[object Object]') {
			try { errString = JSON.stringify(err); }
			catch (e) { errString = ''; }
		}
		err = restmpls.InternalServerError({ reason: errString });
	}
	buildRes(req, res, err);
}

module.exports = {
	'export': handler_export
};