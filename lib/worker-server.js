// MyHouse Worker
// ==============
// pfraze 2013

typeof local === 'undefined' ? (function() {
	// keeps the current message id, used for tracking messages
	var cur_mid = 1;
	function gen_mid() { return cur_mid++; }

	// local
	// ===
	// GLOBAL
	// provides messaging tools to the host environment
	self.local = {
		replyCbs         : {},
		messageListeners : {}
	};

	// INTERNAL
	// message receive handler
	self.addEventListener('message', function(event) {
		var message = event.data;
		// handle replies
		if (message.name === 'reply') {
			var cb = local.replyCbs[message.reply_to];
			if (cb) {
				cb.func.call(cb.context, message);
				delete local.replyCbs[message.reply_to]; // wont need to call again
				return;
			}
		}

		var listeners = local.messageListeners[message.name];

		// streaming
		if (message.name === 'endMessage') {
			var mid = message.data;
			listeners = local.messageListeners[mid]; // inform message listeners
			local.removeAllMessageListeners(mid); // and release their references
		}

		// dispatch
		if (listeners) {
			listeners.forEach(function(listener) {
				listener.func.call(listener.context, message);
			});
		}
	});

	// EXPORTED
	// sends a message to the local
	// - `messageName` is required
	// - returns id of the new message
	// - if `replyCb` is specified, it will be called once if/when the local sends a reply to the message
	local.postMessage = function(messageName, messageData, replyCb, replyCbContext) {
		var message = makeMessage(messageName, messageData);
		doPostMessage(message, replyCb, replyCbContext);
		return message.id;
	};

	// EXPORTED
	// sends a reply to a message from the local
	// - parameter 1 (`orgMessage`) should be the message (or id of the message) originally received from the local
	// - otherwise works exactly like postMessage
	// - NOTE: replies will only be handled by replyCbs registered during the original send
	//   - if a sender is not expecting a reply, it will never be handled
	local.postReply  = function(orgMessage, messageData, replyCb, replyCbContext) {
		var replyToID = (typeof orgMessage === 'object') ? orgMessage.id : orgMessage;
		var message = makeMessage('reply', messageData, replyToID);
		doPostMessage(message, replyCb, replyCbContext);
		return message.id;
	};

	// EXPORTED
	// informs the receiver that no more data will stream, allowing it to release its listeners
	// - parameter 1 (`orgMessageID`) should be the first message's id (returned by postMessage/postReply)
	local.endMessage = function(orgMessageID) {
		return this.postMessage('endMessage', orgMessageID);
	};

	// INTERNAL
	// message object builder
	function makeMessage(name, data, replyToId) {
		var message = {
			id       : gen_mid(),
			reply_to : replyToId,
			name     : name,
			data     : data
		};
		return message;
	}

	// INTERNAL
	// functional body of the post* functions
	function doPostMessage(message, replyCb, replyCbContext) {
		// register response CB, if given
		if (replyCb && typeof replyCb === 'function') {
			local.replyCbs[message.id] = { func:replyCb, context:replyCbContext };
		}
		// post
		self.postMessage(message);
	}

	// EXPORTED
	// registers a callback to handle messages from the local
	// - `messageName` and `func` are required
	local.addMessageListener = function(messageName, func, context) {
		if (!(messageName in local.messageListeners)) {
			// create new listener array
			local.messageListeners[messageName] = [];
		}
		// add to list
		local.messageListeners[messageName].push({ func:func, context:context });
	};
	local.onMessage = local.addMessageListener;

	// EXPORTED
	// removes a given callback from the message listeners
	local.removeMessageListener = function(messageName, func) {
		if (messageName in local.messageListeners) {
			// filter out the listener
			var filterFn = function(listener) { return listener.func != func; };
			local.messageListeners[messageName] = local.messageListeners[messageName].filter(filterFn);
			// remove array if empty
			if (local.messageListeners[messageName].length === 0) {
				delete local.messageListeners[messageName];
			}
		}
	};

	// EXPORTED
	// removes all callbacks from the given message
	local.removeAllMessageListeners = function(messageName) {
		if (messageName in local.messageListeners) {
			delete local.messageListeners[messageName];
		}
	};

	// EXPORTED
	// sends log message
	local.log = function() {
		var args = Array.prototype.slice.call(arguments);
		if (args.length > 1) {
			local.postMessage('log', args);
		} else {
			local.postMessage('log', args[0]);
		}
	};

	// EXPORTED
	// logs the current stack
	local.logStack = function() {
		try {
			stack_trace._fake+=0;
		} catch(e) {
			local.log(e.stack);
		}
	};

	// INTERNAL
	// removes an object from use
	local.onMessage('nullify', function(message) {
		local.log('nullifying: ' + message.data);
		if (message && typeof message.data === 'string') {
			// destroy the top-level reference
			self[message.data] = null;
		} else {
			throw "'nullify' message must include a valid string";
		}
	});

	// INTERNAL
	local.onMessage('importScripts', function(message) {
		local.log('importingScripts: ' + message.data);
		if (message && message.data) {
			try {
				self.importScripts(message.data);
			} catch(e) {
				local.postReply(message, { error:true, reason:e.toString() });
				throw e;
			}
		} else {
			throw "'importScripts' message must include a valid array/string";
		}
		local.postReply(message, { error:false });
	});

	// let the parent know we've loaded
	local.postMessage('ready', null, function(reply) {
		local.config = reply.data;
	});
})() : null;

// a few conveniences
var console = {};
console.log = local.log;// Local Worker Core
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