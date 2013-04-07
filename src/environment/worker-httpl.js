// Local Worker Core
// =================
// sets up various libraries

// override link's dispatch() behavior to post it to the host document
// - mirrors Server.prototype.postHttpRequestMessage in server.js
Link.setRequestDispatcher(function(request) {
	if (typeof request == 'function') {
		return localApp.logStack();
	}

	var resPromise = Local.promise();
	localApp.postMessage('httpRequest', request, function(reply) {
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
		localApp.onMessage(reply.id, function(streamMessage) {
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
	var msgStream = localApp.postMessage('httpSubscribe', request);

	// change event listening to pass the request to the environment
	eventStream.addListener = eventStream.on = function(e, listener) {
		localApp.postMessage(msgStream, e, function(reply) {
			// setup the stream as an event-pipe
			localApp.onMessage(reply.id, function(eventMessage) {
				listener(eventMessage.data);
			});
		});
	};

	return eventStream;
});

// server-func setter interface
localApp.onHttpRequest = function(func, context) {
	if (context) { localApp.httpRequestHandler = function() { return func.apply(context, arguments); }; }
	else { localApp.httpRequestHandler = func; }
};

// server-obj setter interface
// (used by Server objects)
localApp.setServer = function(obj) {
	if (typeof obj == 'function')
		obj = new obj(arguments[1] || {});
	obj.config = localApp.config;
	localApp.onHttpRequest(obj.handleHttpRequest, obj);
};

// handler for when the server asks the app to fulfill an HTTP request
// - mirrors Server.prototype.onWorkerHttpRequest in server.js
localApp.onMessage('httpRequest', function(message) {
	var request = message.data;
	if (localApp.httpRequestHandler) {
		// pipe the response back to the document
		var handleResponse = function(res) {
			var stream = localApp.postReply(message, res);
			res.on('data', function(data) { localApp.postMessage(stream, data); });
			res.on('end', function() { localApp.endMessage(stream); });
		};

		// all errors, just send back to the document
		var handleErrors = function(err) { handleResponse(err.response); };

		// setup the response promise
		var resPromise = Local.promise();
		resPromise.then(handleResponse, handleErrors);

		// create a server response for the request handler to work with
		var response = new Link.ServerResponse(resPromise, request.stream);

		// pass on to the request handler
		localApp.httpRequestHandler(request, response);
	} else {
		// no request handler
		var stream = localApp.postReply(message, { status:404, reason:'Server not loaded' });
		localApp.endMessage(stream);
	}
});

// Server
// ======
// EXPORTED
// core type for all servers, should be used as a prototype
localApp.Server = function() {
};

// request handler, should be overwritten by subclasses
localApp.Server.prototype.handleHttpRequest = function(request, response) {
	response.writeHead(0, 'server not implemented');
	response.end();
};