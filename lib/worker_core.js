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
			var response = new Link.ClientResponse(reply.data.status, reply.data.reason);
			response.headers = reply.data.headers;

			// fulfill/reject
			if (response.status >= 200 && response.status < 300) {
				resPromise.fulfill(response);
			} else if (response.status >= 400 && response.status < 600 || !response.status) {
				resPromise.reject(new Link.ResponseError(response));
			} else {
				// :TODO: protocol handling
			}
			
			if (reply.data.body)
				response.write(reply.data.body);

			// setup streaming
			app.onMessage(reply.id, function(streamMessage) {
				if (streamMessage.name === 'endMessage') { response.end(); }
				else { response.write(streamMessage.data); }
			});
		});
		return resPromise;
	});

	// server-func setter interface
	app.onHttpRequest = function(func, context) {
		if (context) { app.httpRequestHandler = function() { return func.apply(context, arguments); }; }
		else { app.httpRequestHandler = func; }
	};

	// handler for when the server asks the app to fulfill an HTTP request
	// - mirrors Server.prototype.onWorkerHttpRequest in server.js
	app.onMessage('httpRequest', function(message) {
		var request = message.data;
		if (app.httpRequestHandler) {
			// pipe the response back to the document
			var handleResponse = function(res) {
				var stream = app.postReply(message, res);
				res.on('data', function(data) { app.postMessage(stream, data); });
				res.on('end', function() { app.endMessage(stream); });
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
			app.httpRequestHandler(request, response);
		} else {
			// no request handler
			var stream = app.postReply(message, { status:404, reason:'Server not loaded' });
			app.endMessage(stream);
		}
	});
}

// a few conveniences
var console = {};
console.log = app.log;