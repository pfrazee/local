// LinkAP Worker Core
// ==================
// sets up various libraries

importScripts('/lib/link.js');

{
	// LinkJS
	// ======

	// override link's request() behavior to post it to the host document
	// - mirrors Server.prototype.postHttpRequestMessage in server.js
	Link.setRequestDispatcher(function(request) {
		var resPromise = promise();
		app.postMessage('httpRequest', request, function(reply) {
			if (!reply.data) { throw "Invalid httpRequest reply to worker from document"; }

			// instantiate client response interface and pass onto the promise
			var response = new ClientResponse(reply.data.status, reply.data.reason);
			response.headers = reply.data.headers;
			resPromise.fulfill(response);
			
			if (reply.data.body)
				response.write(reply.data.body);

			// setup streaming
			this.worker.onMessage(reply.id, function(streamMessage) {
				if (streamMessage.name === 'endMessage') {
					response.end();
				} else {
					response.write(streamMessage.data.body);
				}
			});
		});
		return resPromise;
	});

	// server-func setter interface
	app.onHttpRequest = function(func) {
		app.httpRequestHandler = func;
	};

	// handler for when the server asks the app to fulfill an HTTP request
	// - mirrors Server.prototype.onWorkerHttpRequest in server.js
	app.onMessage('httpRequest', function(message) {
		var request = message.data;
		if (app.httpRequestHandler) {
			// pipe the response back to the document
			var handleResponse = function(res) {
				var stream = app.postReply(message, res);
				res.on('data', function(data) {
					app.postMessage(stream, data);
				});
				res.on('end', function() {
					app.endMessage(stream);
				});
			};

			// setup the response promise
			var resPromise = promise();
			resPromise
				.then(handleResponse)
				.except(function(err) { handleResponse(err.response); });

			// create a server response for the request handler to work with
			var response = new Link.ServerResponse(resPromise, request.stream);

			// pass on to the request handler
			app.httpRequestHandler(request, response);
		} else {
			var stream = app.postReply(message, { status:404, reason:'Server not loaded' });
			app.endMessage(stream);
		}
	});
}