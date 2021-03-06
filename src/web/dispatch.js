var util = require('../util');
var helpers = require('./helpers.js');
var schemes = require('./schemes.js');
var Request = require('./request.js');
var Response = require('./response.js');
var contentTypes = require('./content-types.js');

var webDispatchWrapper;

// dispatch()
// ==========
// EXPORTED
// HTTP request dispatcher
// - `request` param:
//   - if string, creates GET request for json
//   - if object, requires `url`, sends immediately (so you cant stream request body)
//   - if Response, leaves you to run write() and end() (so you can stream request body)
// - `request.query`: optional object, additional query params
// - `request.headers`: optional object
// - `request.body`: optional request body
// - `request.stream`: optional boolean, stream the response? If falsey, will buffer and deserialize the response
// - `request.binary`: optional boolean, receive a binary arraybuffer response? Only applies to HTTP/S
// - returns a `Promise` object
//   - on success (status code 2xx), the promise is fulfilled with a `ClientResponse` object
//   - on failure (status code 4xx,5xx), the promise is rejected with a `ClientResponse` object
//   - all protocol (status code 1xx,3xx) is handled internally
function dispatch(request) {
	if (!request) { throw new Error("No request provided to dispatch()"); }
	if (typeof request == 'string')
		request = { url: request };

	// Create the request if needed
	var body = null, shouldAutoSendRequestBody = false;
	if (!(request instanceof Request)) {
		shouldAutoSendRequestBody = true; // we're going to end() with req.body

		var timeout = request.timeout;
		request = new Request(request);
		if (timeout) { request.setTimeout(timeout); } // :TODO: should this be in the request constructor?

		// pull out body for us to send
		body = request.body;
		request.body = '';
	}
	if (!request.url) { throw new Error("No url on request"); }

	// If given a nav: scheme, spawn a agent to handle it
	var scheme = parseScheme(request.url);
	if (scheme == 'nav') {
		var request2 = new Request(request); // clone before modifying
		var url = request2.url;
		delete request2.url;
		var response_ = require('./agent.js').agent(url).dispatch(request2);
		request.on('data', request2.write.bind(request2));
		request.on('end', request2.end.bind(request2));
		if (shouldAutoSendRequestBody) request.end(body);
		return response_;
	}

	// Prep request
	Object.defineProperty(request, 'urld', { value: helpers.parseUri(request.url), configurable: true, enumerable: false, writable: true }); // (urld = url description)
	if (request.urld.query) {
		// Extract URL query parameters into the request's query object
		var q = contentTypes.deserialize('application/x-www-form-urlencoded', request.urld.query);
		for (var k in q)
			request.query[k] = q[k];
		request.urld.relative = request.urld.path + ((request.urld.anchor) ? ('#'+request.urld.anchor) : '');
		request.url = scheme+'://'+request.urld.authority+request.urld.relative;
	}
	request.serializeHeaders();

	// Setup response object
	var requestStartTime;
	var response = new Response();
	var response_ = require('../promises.js').promise();
	request.on('close', function() { response.close(); });
	response.on('headers', function() {
		response.deserializeHeaders();
		response.processHeaders(request);
	});
	response.on('close', function() {
		// Track latency
		response.latency = Date.now() - requestStartTime;
		// Close the request
		request.close();
	});
	if (request.stream) {
		// streaming, fulfill on 'headers'
		response.on('headers', function(response) {
			fulfillResponsePromise(response_, response);
		});
	} else {
		// buffering, fulfill on 'close'
		response.on('close', function() {
			fulfillResponsePromise(response_, response);
		});
	}

	// Suspend events until the scheme handler gets a chance to wire up
	// (allows async to occur in the webDispatchWrapper)
	request.suspendEvents();
	response.suspendEvents();

	// Create function to be called by the dispatch wrapper
	var dispatchFn = function(request, response, schemeHandler) {
		// execute by scheme
		requestStartTime = Date.now();
		schemeHandler = schemeHandler || schemes.get(scheme);
		if (!schemeHandler) {
			response.writeHead(0, 'unsupported scheme "'+scheme+'"');
			response.end();
			request.resumeEvents();
			response.resumeEvents();
		} else {
			// dispatch according to scheme
			schemeHandler(request, response);
			// now that the scheme handler has wired up, the spice must flow
			request.resumeEvents();
			response.resumeEvents();
			// autosend request body if not given a Request `request`
			if (shouldAutoSendRequestBody) { request.end(body); }
		}
		return response_;
	};

	// Setup the arguments list for the dispatch wrapper to include any additional params passed to dispatch()
	// aka (request, response, dispatch, args...)
	// this allows apps to do something like dispatch(request, extraParam1, extraParam2) and have the dispatch wrapper use those params
	var args = Array.prototype.slice.call(arguments, 1);
	args.unshift(dispatchFn);
	args.unshift(response);
	args.unshift(request);

	// Wait until next tick, to make sure dispatch() is always async
	util.nextTick(function() {
		// Allow the wrapper to audit the message
		webDispatchWrapper.apply(null, args);
	});

	response_.request = request;
	return response_;
}

// EXPORTED
// fulfills/reject a promise for a response with the given response
// - exported because its pretty useful
function fulfillResponsePromise(p, response) {
	// wasnt streaming, fulfill now that full response is collected
	if (response.status >= 200 && response.status < 400)
		p.fulfill(response);
	else if (response.status >= 400 && response.status < 600 || response.status === 0)
		p.reject(response);
	else
		p.fulfill(response); // :TODO: 1xx protocol handling
}

// EXPORTED
function setDispatchWrapper(wrapperFn) {
	webDispatchWrapper = wrapperFn;
}

setDispatchWrapper(function(request, response, dispatch) {
	dispatch(request, response);
});

// INTERNAL
function parseScheme(url) {
	var schemeMatch = /^([^.^:]*):/.exec(url);
	if (!schemeMatch) {
		// shorthand/default schemes
		if (url.indexOf('//') === 0)
			return 'http';
		else if (url.indexOf('||') === 0)
			return 'nav';
		else
			return 'httpl';
	}
	return schemeMatch[1];
}


function makeDispSugar(method) {
	return function(options) {
		var req = options || {};
		if (typeof req == 'string') {
			req = { url: req };
		}
		req.method = method;
		return dispatch(req);
	};
}
function makeDispWBodySugar(method) {
	return function(body, options) {
		var req = options || {};
		if (typeof req == 'string') {
			req = { url: req };
		}
		req.method = method;
		req.body = body;
		return dispatch(req);
	};
}

module.exports = {
	dispatch: dispatch,
	fulfillResponsePromise: fulfillResponsePromise,
	setDispatchWrapper: setDispatchWrapper,

	SUBSCRIBE: makeDispSugar('SUBSCRIBE'),
	HEAD:      makeDispSugar('HEAD'),
	GET:       makeDispSugar('GET'),
	DELETE:    makeDispSugar('DELETE'),
	POST:      makeDispWBodySugar('POST'),
	PUT:       makeDispWBodySugar('PUT'),
	PATCH:     makeDispWBodySugar('PATCH'),
	NOTIFY:    makeDispWBodySugar('NOTIFY'),
};