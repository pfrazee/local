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
util.mixin.call(module.exports, require('./web/workers.js'));
util.mixin.call(module.exports, require('./web/subscribe.js'));

// Request sugars
function dispatch(headers) {
	var req = new module.exports.Request(headers);
	req.autoEnd();
	return req;
}
function makeRequestSugar(method) {
	return function(url, params) {
		return dispatch({ method: method, url: url, params: params });
	};
}
function makeRequestAcceptSugar(method, type) {
	return function(url, params) {
		return dispatch({ method: method, url: url, params: params }).accept(type);
	};
}
function makeRequestBodySugar(method, type) {
	return function(url, params, body) {
		if (body === void 0 && params) {
			body = params;
			params = undefined;
		}
		return dispatch({ method: method, url: url, params: params }).contentType(type).write(body);
	};
}
module.exports.dispatch =  dispatch;
module.exports.head =      makeRequestSugar('HEAD');
module.exports.get =       makeRequestSugar('GET');
module.exports.getText =   makeRequestAcceptSugar('GET', 'text');
module.exports.getHtml =   makeRequestAcceptSugar('GET', 'html');
module.exports.getJson =   makeRequestAcceptSugar('GET', 'json');
module.exports.getCsv =    makeRequestAcceptSugar('GET', 'csv');
module.exports.post =      makeRequestSugar('POST');
module.exports.postText =  makeRequestBodySugar('POST', 'text');
module.exports.postHtml =  makeRequestBodySugar('POST', 'html');
module.exports.postJson =  makeRequestBodySugar('POST', 'json');
module.exports.postCsv =   makeRequestBodySugar('POST', 'csv');
module.exports.put =       makeRequestSugar('PUT');
module.exports.putText =   makeRequestBodySugar('PUT', 'text');
module.exports.putHtml =   makeRequestBodySugar('PUT', 'html');
module.exports.putJson =   makeRequestBodySugar('PUT', 'json');
module.exports.putCsv =    makeRequestBodySugar('PUT', 'csv');
module.exports.patch =     makeRequestSugar('PATCH');
module.exports.patchText = makeRequestBodySugar('PATCH', 'text');
module.exports.patchHtml = makeRequestBodySugar('PATCH', 'html');
module.exports.patchJson = makeRequestBodySugar('PATCH', 'json');
module.exports.patchCsv =  makeRequestBodySugar('PATCH', 'csv');
module.exports.delete =    makeRequestSugar('DELETE');

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