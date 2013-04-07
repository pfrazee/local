// MyHouse Worker
// ==============
// pfraze 2013

typeof localApp === 'undefined' ? (function() {
	// keeps the current message id, used for tracking messages
	var cur_mid = 1;
	function gen_mid() { return cur_mid++; }

	// localApp
	// ===
	// GLOBAL
	// provides messaging tools to the host environment
	self.localApp = {
		replyCbs         : {},
		messageListeners : {}
	};

	// INTERNAL
	// message receive handler
	self.addEventListener('message', function(event) {
		var message = event.data;
		// handle replies
		if (message.name === 'reply') {
			var cb = localApp.replyCbs[message.reply_to];
			if (cb) {
				cb.func.call(cb.context, message);
				delete localApp.replyCbs[message.reply_to]; // wont need to call again
				return;
			}
		}

		var listeners = localApp.messageListeners[message.name];

		// streaming
		if (message.name === 'endMessage') {
			var mid = message.data;
			listeners = localApp.messageListeners[mid]; // inform message listeners
			localApp.removeAllMessageListeners(mid); // and release their references
		}

		// dispatch
		if (listeners) {
			listeners.forEach(function(listener) {
				listener.func.call(listener.context, message);
			});
		}
	});

	// EXPORTED
	// sends a message to the localApp
	// - `messageName` is required
	// - returns id of the new message
	// - if `replyCb` is specified, it will be called once if/when the localApp sends a reply to the message
	localApp.postMessage = function(messageName, messageData, replyCb, replyCbContext) {
		var message = makeMessage(messageName, messageData);
		doPostMessage(message, replyCb, replyCbContext);
		return message.id;
	};

	// EXPORTED
	// sends a reply to a message from the localApp
	// - parameter 1 (`orgMessage`) should be the message (or id of the message) originally received from the localApp
	// - otherwise works exactly like postMessage
	// - NOTE: replies will only be handled by replyCbs registered during the original send
	//   - if a sender is not expecting a reply, it will never be handled
	localApp.postReply  = function(orgMessage, messageData, replyCb, replyCbContext) {
		var replyToID = (typeof orgMessage === 'object') ? orgMessage.id : orgMessage;
		var message = makeMessage('reply', messageData, replyToID);
		doPostMessage(message, replyCb, replyCbContext);
		return message.id;
	};

	// EXPORTED
	// informs the receiver that no more data will stream, allowing it to release its listeners
	// - parameter 1 (`orgMessageID`) should be the first message's id (returned by postMessage/postReply)
	localApp.endMessage = function(orgMessageID) {
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
			localApp.replyCbs[message.id] = { func:replyCb, context:replyCbContext };
		}
		// post
		self.postMessage(message);
	}

	// EXPORTED
	// registers a callback to handle messages from the localApp
	// - `messageName` and `func` are required
	localApp.addMessageListener = function(messageName, func, context) {
		if (!(messageName in localApp.messageListeners)) {
			// create new listener array
			localApp.messageListeners[messageName] = [];
		}
		// add to list
		localApp.messageListeners[messageName].push({ func:func, context:context });
	};
	localApp.onMessage = localApp.addMessageListener;

	// EXPORTED
	// removes a given callback from the message listeners
	localApp.removeMessageListener = function(messageName, func) {
		if (messageName in localApp.messageListeners) {
			// filter out the listener
			var filterFn = function(listener) { return listener.func != func; };
			localApp.messageListeners[messageName] = localApp.messageListeners[messageName].filter(filterFn);
			// remove array if empty
			if (localApp.messageListeners[messageName].length === 0) {
				delete localApp.messageListeners[messageName];
			}
		}
	};

	// EXPORTED
	// removes all callbacks from the given message
	localApp.removeAllMessageListeners = function(messageName) {
		if (messageName in localApp.messageListeners) {
			delete localApp.messageListeners[messageName];
		}
	};

	// EXPORTED
	// sends log message
	localApp.log = function() {
		var args = Array.prototype.slice.call(arguments);
		if (args.length > 1) {
			localApp.postMessage('log', args);
		} else {
			localApp.postMessage('log', args[0]);
		}
	};

	// EXPORTED
	// logs the current stack
	localApp.logStack = function() {
		try {
			stack_trace._fake+=0;
		} catch(e) {
			localApp.log(e.stack);
		}
	};

	// INTERNAL
	// removes an object from use
	localApp.onMessage('nullify', function(message) {
		localApp.log('nullifying: ' + message.data);
		if (message && typeof message.data === 'string') {
			// destroy the top-level reference
			self[message.data] = null;
		} else {
			throw "'nullify' message must include a valid string";
		}
	});

	// INTERNAL
	localApp.onMessage('importScripts', function(message) {
		localApp.log('importingScripts: ' + message.data);
		if (message && message.data) {
			try {
				self.importScripts(message.data);
			} catch(e) {
				localApp.postReply(message, { error:true, reason:e.toString() });
				throw e;
			}
		} else {
			throw "'importScripts' message must include a valid array/string";
		}
		localApp.postReply(message, { error:false });
	});

	// let the parent know we've loaded
	localApp.postMessage('ready', null, function(reply) {
		localApp.config = reply.data;
	});
})() : null;

// a few conveniences
var console = {};
console.log = localApp.log;