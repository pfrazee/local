var util = require('./util');

module.exports = {
	cfg: require('./config.js'),

	Request: require('./web/request.js'),
	Response: require('./web/response.js'),
	IncomingRequest: require('./web/incoming-request.js'),
	IncomingResponse: require('./web/incoming-response.js'),
	Bridge: require('./web/bridge.js'),
	UriTemplate: require('./web/uri-template.js'),

	util: util,
	schemes: require('./web/schemes.js'),
	httpHeaders: require('./web/http-headers.js'),
	contentTypes: require('./web/content-types.js')
};
util.mixin.call(module.exports, require('./constants.js'));
util.mixin.call(module.exports, require('./promises.js'));
util.mixin.call(module.exports, require('./request-event.js'));
util.mixin.call(module.exports, require('./web/helpers.js'));
util.mixin.call(module.exports, require('./web/links.js'));
util.mixin.call(module.exports, require('./web/httpl.js'));
util.mixin.call(module.exports, require('./web/response-templates.js'));
util.mixin.call(module.exports, require('./web/handler-function.js'));
util.mixin.call(module.exports, require('./web/workers.js'));
util.mixin.call(module.exports, require('./web/subscribe.js'));
util.mixin.call(module.exports, require('./web/client.js'));

// Request sugars
function dispatch(headers) {
	var req = new module.exports.Request(headers);
	req.autoEnd();
	return req;
}
function makeRequestSugar(method) {
	return function(url, params) {
        if (url instanceof module.exports.Client) {
            return url[method]();
        }
		return dispatch({ method: method, url: url, params: params });
	};
}
module.exports.dispatch =  dispatch;
module.exports.HEAD =      makeRequestSugar('HEAD');
module.exports.GET =       makeRequestSugar('GET');
module.exports.POST =      makeRequestSugar('POST');
module.exports.PUT =       makeRequestSugar('PUT');
module.exports.PATCH =     makeRequestSugar('PATCH');
module.exports.DELETE =    makeRequestSugar('DELETE');
module.exports.SUBSCRIBE = makeRequestSugar('SUBSCRIBE');
module.exports.NOTIFY =    makeRequestSugar('NOTIFY');

// Create globals
var global, web = module.exports;
if (typeof window != 'undefined') global = window;
else if (typeof self != 'undefined') global = self;
if (global) {
	global.web = web;
}

// Patch arrays to handle promises
Object.defineProperty(Array.prototype, 'thenEach', {
	value: function(a, b) {
		var callA = function(i, v) { return a(v, i); };
		var callB = function(i, v) { return b(v, i); };
		return this.map(function(v, i) {
			return web.promise(v).then(callA.bind(null, i), callB.bind(null, i));
		});
	}
});
Object.defineProperty(Array.prototype, 'always', {
	value: function(a) {
		return web.promise.bundle(this).always(a);
	}
});
Object.defineProperty(Array.prototype, 'then', {
	value: function(a, b) {
		return web.promise.all(this).then(a, b);
	}
});

// Run worker setup (does nothing outside of a worker)
require('./worker');