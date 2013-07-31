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
// - `request.stream`: boolean, stream the response? If falsey, will buffer and deserialize the response
// - `request.binary`: boolean, receive a binary arraybuffer response? Only applies to HTTP/S
// - returns a `Promise` object
//   - on success (status code 2xx), the promise is fulfilled with a `ClientResponse` object
//   - on failure (status code 4xx,5xx), the promise is rejected with a `ClientResponse` object
//   - all protocol (status code 1xx,3xx) is handled internally
local.web.dispatch = function dispatch(request) {
	if (!request) { throw "no request param provided to request"; }
	if (typeof request == 'string')
		request = { url: request };
	if (!request.url)
		throw "no url on request";
	var response = new local.web.Response();

	// if not given a local.web.Request, make one and remember to end the request ourselves
	var body = null, selfEnd = false;
	if (!(request instanceof local.web.Request)) {
		body = request.body;
		request = new local.web.Request(request);
		selfEnd = true; // we're going to end()
	}

	// parse the url scheme
	var scheme, firstColonIndex = request.url.indexOf(':');
	if (firstColonIndex === -1)
		scheme = 'http'; // default for relative paths
	else
		scheme = request.url.slice(0, firstColonIndex);

	// if given a proxy: scheme, that's not something we can handle
	if (scheme == 'proxy')
		scheme = convertToProxyRequest(request); // so convert the request to something we can do

	// update link headers to be absolute
	response.on('headers', function() { processResponseHeaders(request, response); });

	// wire up the response with the promise
	var response_ = local.promise();
	if (request.stream) {
		// streaming, fulfill on 'headers'
		response.on('headers', function(response) {
			local.web.fulfillResponsePromise(response_, response);
		});
	} else {
		// buffering, fulfill on 'close'
		response.on('close', function() {
			local.web.fulfillResponsePromise(response_, response);
		});
	}

	// just until the scheme handler gets a chance to wire up
	// (allows async to occur in the webDispatchWrapper)
	request.suspendEvents();
	response.suspendEvents();

	// pull any extra arguments that may have been passed
	// form the paramlist: (request, response, dispatch, args...)
	var args = Array.prototype.slice.call(arguments, 1);
	args.unshift(function(request, response, schemeHandler) {
		// execute by scheme
		schemeHandler = schemeHandler || local.web.schemes.get(scheme);
		if (!schemeHandler) {
			response.writeHead(0, 'unsupported scheme "'+scheme+'"');
			response.end();
		} else {
			// dispatch according to scheme
			schemeHandler(request, response);
			// now that the scheme handler has wired up, the spice must flow
			request.resumeEvents();
			response.resumeEvents();
			// autosend request body if not given a local.web.Request `request`
			if (selfEnd) request.end(body);
		}
		return response_;
	});
	args.unshift(response);
	args.unshift(request);

	// allow the wrapper to audit the packet
	webDispatchWrapper.apply(null, args);

	response_.request = request;
	return response_;
};

// EXPORTED
// fulfills/reject a promise for a response with the given response
// - exported because its pretty useful
local.web.fulfillResponsePromise = function(promise, response) {
	// wasnt streaming, fulfill now that full response is collected
	if (response.status >= 200 && response.status < 400)
		promise.fulfill(response);
	else if (response.status >= 400 && response.status < 600 || response.status === 0)
		promise.reject(response);
	else
		promise.fulfill(response); // :TODO: 1xx protocol handling
};

local.web.setDispatchWrapper = function(wrapperFn) {
	webDispatchWrapper = wrapperFn;
};

local.web.setDispatchWrapper(function(request, response, dispatch) {
	dispatch(request, response);
});

// INTERNAL
// Helper to massage response values
var isUrlAbsoluteRE = /(:\/\/)|(^[-A-z0-9]*\.[-A-z0-9]*)/; // has :// or starts with ___.___
function processResponseHeaders(request, response) {
	if (response.headers.link) {
		response.headers.link.forEach(function(link) {
			if (isUrlAbsoluteRE.test(link.href) === false)
				link.href = local.web.joinRelPath(request.urld, link.href);
		});
	}
}

// INTERNAL
// Helper to convert a request using a proxy: scheme url into a proxy request using http/s/l
// - returns the new scheme of the request
function convertToProxyRequest(request) {
	// split into url list
	var urls, firstColonIndex;
	try {
		firstColonIndex = request.url.indexOf(':');
		urls = request.url.slice(firstColonIndex+1).split('|');
	} catch(e) {
		console.warn('Failed to parse proxy URL', request.url, e);
		return response.writeHead(0, 'invalid proxy URL').end();
	}

	// update request to instruct proxy
	var proxyUrl = urls.shift();
	var destUrl = null;
	if (!urls[0]) {
		// only one url in the proxy string, just un-proxyify the url
		// eg proxy:http://grimwire.com -> http://grimwire.com
		request.url = proxyUrl;
	} else {
		if (!urls[1]) {
			// two urls in the proxy string
			// eg proxy:httpl://myproxy.grim|http://grimwire.com -> [httpl://myproxy.grim, http://grimwire.com]
			destUrl = urls[0];
		} else {
			// multiple urls in the proxy string, reform destination as a smaller proxy url
			// eg proxy:httpl://myproxy.grim|httpl://myproxy2.grim|http://grimwire.com
			//     -> [httpl://myproxy.grim, proxy:httpl://myproxy2.grim|http://grimwire.com]
			destUrl = 'proxy:'+urls.join('|');
		}

		// reform request as a proxy request
		request.url = proxyUrl;
		request.headers['proxy-to'] = destUrl;
		request.headers['proxy-method'] = request.method;
		request.method = 'PROXY';
	}

	// return new scheme
	firstColonIndex = request.url.indexOf(':');
	return request.url.slice(0, firstColonIndex);
}