// Worker HTTP
// ===========

// override dispatch() behavior to post it to the host document
// - mirrors Server.prototype.postHttpRequestMessage in local.workers.Server
local.http.setRequestDispatcher(function(request) {
	if (typeof request == 'function') {
		return local.worker.logStack();
	}

	var resPromise = local.promise();
	local.worker.postNamedMessage('httpRequest', request, function(reply) {
		if (!reply.data) { throw "Invalid httpRequest reply to worker from document"; }

		// instantiate client response interface and pass onto the promise
		var response = new local.http.ClientResponse(reply.data.status, reply.data.reason);
		response.headers = reply.data.headers;

		// write body now if not streaming
		if (!request.stream && reply.data.body)
			response.write(reply.data.body);

		// fulfill/reject
		if (response.status >= 200 && response.status < 300)
			resPromise.fulfill(response);
		else if (response.status >= 400 || !response.status)
			resPromise.reject(response);
		else
			resPromise.fulfill(response); // :TODO: 1xx protocol handling

		// write body now if streaming
		if (request.stream && reply.data.body)
			response.write(reply.data.body);

		// setup streaming
		local.worker.onNamedMessage(reply.id, function(streamMessage) {
			if (streamMessage.name === 'endMessage') { response.end(); }
			else { response.write(streamMessage.data); }
		});
	});
	return resPromise;
});

// override subscribe() behavior to post it to the host document
local.http.setEventSubscriber(function(request) {
	var eventStream = new local.http.EventStream();

	// have the environment create the subscription
	var msgStream = local.worker.postNamedMessage('httpSubscribe', request);

	// change event listening to pass the request to the environment
	eventStream.addListener = eventStream.on = function(e, listener) {
		local.worker.postNamedMessage(msgStream, e, function(reply) {
			// setup the stream as an event-pipe
			local.worker.onNamedMessage(reply.id, function(eventMessage) {
				listener(eventMessage.data);
			});
		});
	};

	return eventStream;
});

// handler for when the server asks the app to fulfill an HTTP request
// - mirrors Server.prototype.onWorkerHttpRequest in local.workers.Server
local.worker.onNamedMessage('httpRequest', function(message) {
	var request = message.data;
	if (main) {
		// pipe the response back to the document
		var handleResponse = function(res) {
			var stream = local.worker.postReply(message, res);
			if (res.isConnOpen) {
				res.on('data', function(data) { local.worker.postNamedMessage(stream, data); });
				res.on('end', function() { local.worker.endMessage(stream); });
			} else
				local.worker.endMessage(stream);
		};

		// setup the response promise
		var resPromise = local.promise();
		resPromise.then(handleResponse, handleResponse);

		// create a server response for the request handler to work with
		var response = new local.http.ServerResponse(resPromise, request.stream);

		// pass on to the request handler
		main(request, response);
	} else {
		// no request handler
		var stream = local.worker.postReply(message, { status:404, reason:'server not loaded' });
		local.worker.endMessage(stream);
	}
});