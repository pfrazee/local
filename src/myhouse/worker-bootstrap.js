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
console.log = local.log;