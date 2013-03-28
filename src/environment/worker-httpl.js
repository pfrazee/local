// Local Worker Core
// =================
// sets up various libraries

importScripts('local/promises.js');
importScripts('local/link.js');


// LinkJS
// ======

// override link's dispatch() behavior to post it to the host document
// - mirrors Server.prototype.postHttpRequestMessage in server.js
Link.setRequestDispatcher(function(request) {
	if (typeof request == 'function') {
		return local.logStack();
	}

	var resPromise = promise();
	local.postMessage('httpRequest', request, function(reply) {
		if (!reply.data) { throw "Invalid httpRequest reply to worker from document"; }

		// instantiate client response interface and pass onto the promise
		var response = new Link.ClientResponse(reply.data.status, reply.data.reason);
		response.headers = reply.data.headers;

		// write body now if not streaming
		if (!request.stream && (reply.data.body !== null && typeof reply.data.body != 'undefined')) {
			response.write(reply.data.body);
		}

		// fulfill/reject
		if (response.status >= 200 && response.status < 300) {
			resPromise.fulfill(response);
		} else if (response.status >= 400 && response.status < 600 || !response.status) {
			resPromise.reject(new Link.ResponseError(response));
		} else {
			// :TODO: protocol handling
		}

		// write body now if streaming
		if (request.stream && (reply.data.body !== null && typeof reply.data.body != 'undefined')) {
			response.write(reply.data.body);
		}

		// setup streaming
		local.onMessage(reply.id, function(streamMessage) {
			if (streamMessage.name === 'endMessage') { response.end(); }
			else { response.write(streamMessage.data); }
		});
	});
	return resPromise;
});

// override link's subscribe() behavior to post it to the host document
Link.setEventSubscriber(function(request) {
	var eventStream = new Link.EventStream();

	// have the environment create the subscription
	var msgStream = local.postMessage('httpSubscribe', request);

	// change event listening to pass the request to the environment
	eventStream.addListener = eventStream.on = function(e, listener) {
		local.postMessage(msgStream, e, function(reply) {
			// setup the stream as an event-pipe
			local.onMessage(reply.id, function(eventMessage) {
				listener(eventMessage.data);
			});
		});
	};

	return eventStream;
});

// server-func setter interface
local.onHttpRequest = function(func, context) {
	if (context) { local.httpRequestHandler = function() { return func.apply(context, arguments); }; }
	else { local.httpRequestHandler = func; }
};

// server-obj setter interface
// (used by Server objects)
local.setServer = function(obj) {
	if (typeof obj == 'function')
		obj = new obj(arguments[1] || {});
	obj.config = local.config;
	local.onHttpRequest(obj.handleHttpRequest, obj);
};

// handler for when the server asks the app to fulfill an HTTP request
// - mirrors Server.prototype.onWorkerHttpRequest in server.js
local.onMessage('httpRequest', function(message) {
	var request = message.data;
	if (local.httpRequestHandler) {
		// pipe the response back to the document
		var handleResponse = function(res) {
			var stream = local.postReply(message, res);
			res.on('data', function(data) { local.postMessage(stream, data); });
			res.on('end', function() { local.endMessage(stream); });
		};

		// all errors, just send back to the document
		var handleErrors = function(err) { handleResponse(err.response); };

		// setup the response promise
		var resPromise = promise();
		resPromise
			.then(handleResponse)
			.except(handleErrors);

		// create a server response for the request handler to work with
		var response = new Link.ServerResponse(resPromise, request.stream);

		// pass on to the request handler
		local.httpRequestHandler(request, response);
	} else {
		// no request handler
		var stream = local.postReply(message, { status:404, reason:'Server not loaded' });
		local.endMessage(stream);
	}
});

// Server
// ======
// EXPORTED
// core type for all servers, should be used as a prototype
local.Server = function() {
};

// request handler, should be overwritten by subclasses
local.Server.prototype.handleHttpRequest = function(request, response) {
	response.writeHead(0, 'server not implemented');
	response.end();
};