// MyHouse
// =======
// pfraze 2012

typeof app === 'undefined' ? (function() {
	// keeps the current message id, used for tracking messages
	var cur_mid = 1;
	function gen_mid() { return cur_mid++; }

	// app
	// ===
	// GLOBAL
	// provides messaging tools to the host environment
	self.app = {
		replyCbs         : {},
		messageListeners : {}
	};

	// INTERNAL
	// message receive handler
	self.addEventListener('message', function(event) {
		var message = event.data;
		// handle replies
		if (message.name === 'reply') {
			var cb = app.replyCbs[message.reply_to];
			if (cb) {
				cb.func.call(cb.context, message);
				delete app.replyCbs[message.reply_to]; // wont need to call again
				return;
			}
		}

		var listeners = app.messageListeners[message.name];
		
		// streaming
		if (message.name === 'endMessage') {
			var mid = message.data;
			listeners = app.messageListeners[mid]; // inform message listeners
			app.removeAllMessageListeners(mid); // and release their references
		}

		// dispatch
		if (listeners) {
			listeners.forEach(function(listener) {
				listener.func.call(listener.context, message);
			});
		}
	});

	// EXPORTED
	// sends a message to the sandbox
	// - `messageName` is required
	// - returns id of the new message
	// - if `replyCb` is specified, it will be called once if/when the sandbox sends a reply to the message
	app.postMessage = function(messageName, messageData, replyCb, replyCbContext) {
		var message = makeMessage(messageName, messageData);
		doPostMessage(message, replyCb, replyCbContext);
		return message.id;
	};

	// EXPORTED
	// sends a reply to a message from the sandbox
	// - parameter 1 (`orgMessage`) should be the message (or id of the message) originally received from the sandbox
	// - otherwise works exactly like postMessage
	// - NOTE: replies will only be handled by replyCbs registered during the original send
	//   - if a sender is not expecting a reply, it will never be handled
	app.postReply  = function(orgMessage, messageData, replyCb, replyCbContext) {
		var replyToID = (typeof orgMessage === 'object') ? orgMessage.id : orgMessage;
		var message = makeMessage('reply', messageData, replyToID);
		doPostMessage(message, replyCb, replyCbContext);
		return message.id;
	};

	// EXPORTED
	// informs the receiver that no more data will stream, allowing it to release its listeners
	// - parameter 1 (`orgMessageID`) should be the first message's id (returned by postMessage/postReply)
	app.endMessage = function(orgMessageID) {
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
			app.replyCbs[message.id] = { func:replyCb, context:replyCbContext };
		}
		// post
		self.postMessage(message);
	}

	// EXPORTED
	// registers a callback to handle messages from the sandbox
	// - `messageName` and `func` are required
	app.addMessageListener = function(messageName, func, context) {
		if (!(messageName in app.messageListeners)) {
			// create new listener array
			app.messageListeners[messageName] = [];
		}
		// add to list
		app.messageListeners[messageName].push({ func:func, context:context });
	};
	app.onMessage = app.addMessageListener;

	// EXPORTED
	// removes a given callback from the message listeners
	app.removeMessageListener = function(messageName, func) {
		if (messageName in app.messageListeners) {
			// filter out the listener
			var filterFn = function(listener) { return listener.func != func; };
			app.messageListeners[messageName] = app.messageListeners[messageName].filter(filterFn);
			// remove array if empty
			if (app.messageListeners[messageName].length === 0) {
				delete app.messageListeners[messageName];
			}
		}
	};

	// EXPORTED
	// removes all callbacks from the given message
	app.removeAllMessageListeners = function(messageName) {
		if (messageName in app.messageListeners) {
			delete app.messageListeners[messageName];
		}
	};

	// EXPORTED
	// sends log message
	app.log = function() {
		var args = Array.prototype.slice.call(arguments);
		if (args.length > 1) {
			app.postMessage('log', args);
		} else {
			app.postMessage('log', args[0]);
		}
	};

	// EXPORTED
	// logs the current stack
	app.logStack = function() {
		try {
			stack_trace._fake+=0;
		} catch(e) {
			app.log(e.stack);
		}
	};

	// INTERNAL
	// removes an object from use
	app.onMessage('nullify', function(message) {
		app.log('nullifying: ' + message.data);
		if (message && typeof message.data === 'string') {
			// destroy the top-level reference
			self[message.data] = null;
		} else {
			throw "'nullify' message must include a valid string";
		}
	});

	// INTERNAL
	app.onMessage('importScripts', function(message) {
		app.log('importingScripts: ' + message.data);
		if (message && message.data) {
			try {
				self.importScripts(message.data);
			} catch(e) {
				app.postReply(message, { error:true, reason:e.toString() });
				throw e;
			}
		} else {
			throw "'importScripts' message must include a valid array/string";
		}
		app.postReply(message, { error:false });
	});

	// let the parent know we've loaded
	app.postMessage('ready', null, function(reply) {
		app.config = reply.data;
	});
})() : null;