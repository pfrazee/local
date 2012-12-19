// LinkAP Worker Core
// ==================
// sets up various libraries

importScripts('/lib/link.js');

{
	// LinkJS
	// ======

	// override link's request() behavior to post it to the host document 
	Link.setRequestDispatcher(function(payload, options, response) {
		var firstResponse = true;
		var request = options;
		request.payload = payload;
		app.postMessage('httpRequest', request, function(reply) {
			if (!reply.data) { throw "Invalid httpRequest reply to worker from document"; }
			if (firstResponse) {
				// first response is always headers
				response.writeHead(reply.data.status, reply.data.reason);
			}
			// pull in any newly-set headers
			if (reply.data.headers) {
				for (var k in reply.data.headers) {
					response.setHeader(k, reply.data.headers[k]);
				}
			}
			// write the response body
			if (reply.data.payload) {
				if (/* :TODO: reply.isOpen */ false) {
					response.write(reply.data.payload);
				} else {
					response.end(reply.data.payload);
				}
			}
		});
	});

	// server-func setter interface, for those who are squeamish about direct assignment
	app.onHttpRequest = function(func) {
		app.httpRequestHandler = func;
	};

	// handler for when the server asks the app to fulfill an HTTP request
	app.onMessage('httpRequest', function(message) {
		var request = message.data;
		if (typeof app.httpRequestHandler === 'function') {
			// pipes the response back to the document
			var responseHandler = function(payload, headers, isOpen) {
				var response = headers;
				headers.payload = payload;
				app.postReply(message, response);
				// :TODO:
				// if (!isOpen) {
				// 	app.closeReplies(message);
				// }
			};

			// give the handler a server response to work with
			var response = new Link.ServerResponse({ cb:responseHandler });
			app.httpRequestHandler(request, response);
		} else {
			app.postReply(message, { status:404, reason:'Server not loaded' });
		}
	});
}