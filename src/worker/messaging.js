// Worker Named Messaging
// ======================

(function() {
	// keeps the current message id, used for tracking messages
	var __cur_mid = 1;
	function gen_mid() { return __cur_mid++; }

	// tracked callbacks
	var __replyCbs = {};
	var __messageListeners = {};

	// INTERNAL
	// message receive handler
	self.addEventListener('message', function(event) {
		var message = event.data;
		// handle replies
		if (message.name === 'reply') {
			var cb = __replyCbs[message.reply_to];
			if (cb) {
				cb.func.call(cb.context, message);
				delete __replyCbs[message.reply_to]; // wont need to call again
				return;
			}
		}

		var listeners = __messageListeners[message.name];

		// streaming
		if (message.name === 'endMessage') {
			var mid = message.data;
			listeners = __messageListeners[mid]; // inform message listeners
			local.worker.removeAllNamedMessageListeners(mid); // and release their references
		}

		// dispatch
		if (listeners) {
			listeners.forEach(function(listener) {
				listener.func.call(listener.context, message);
			});
		}
	});

	// EXPORTED
	// sends a message to the document
	// - `messageName` is required
	// - returns id of the new message
	// - if `replyCb` is specified, it will be called once if/when the document sends a reply to the message
	local.worker.postNamedMessage = function(messageName, messageData, replyCb, replyCbContext) {
		var message = makeMessage(messageName, messageData);
		doPostMessage(message, replyCb, replyCbContext);
		return message.id;
	};

	// EXPORTED
	// sends a reply to a message from the document
	// - parameter 1 (`orgMessage`) should be the message (or id of the message) originally received from the document
	// - otherwise works exactly like postNamedMessage
	// - NOTE: replies will only be handled by replyCbs registered during the original send
	//   - if a sender is not expecting a reply, it will never be handled
	local.worker.postReply  = function(orgMessage, messageData, replyCb, replyCbContext) {
		var replyToID = (typeof orgMessage === 'object') ? orgMessage.id : orgMessage;
		var message = makeMessage('reply', messageData, replyToID);
		doPostMessage(message, replyCb, replyCbContext);
		return message.id;
	};

	// EXPORTED
	// informs the receiver that no more data will stream, allowing it to release its listeners
	// - parameter 1 (`orgMessageID`) should be the first message's id (returned by postNamedMessage/postReply)
	local.worker.endMessage = function(orgMessageID) {
		return local.worker.postNamedMessage('endMessage', orgMessageID);
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
			__replyCbs[message.id] = { func:replyCb, context:replyCbContext };
		}
		// post
		try {
			self.postMessage(message);
		} catch(e) {
			message.data = JSONifyMessage(message.data);
			self.postMessage(message);
		}
	}

	// INTERNAL
	// helper to try to get a failed message through
	function JSONifyMessage(data) {
		if (Array.isArray(data))
			return data.map(JSONifyMessage);
		if (data && typeof data == 'object')
			return JSON.stringify(data);
		return data;
	}

	// EXPORTED
	// registers a callback to handle messages from the document
	// - `messageName` and `func` are required
	local.worker.addNamedMessageListener = function(messageName, func, context) {
		if (!(messageName in __messageListeners)) {
			// create new listener array
			__messageListeners[messageName] = [];
		}
		// add to list
		__messageListeners[messageName].push({ func:func, context:context });
	};
	local.worker.onNamedMessage = local.worker.addNamedMessageListener;

	// EXPORTED
	// removes a given callback from the message listeners
	local.worker.removeNamedMessageListener = function(messageName, func) {
		if (messageName in __messageListeners) {
			// filter out the listener
			var filterFn = function(listener) { return listener.func != func; };
			__messageListeners[messageName] = __messageListeners[messageName].filter(filterFn);
			if (__messageListeners[messageName].length === 0)
				delete __messageListeners[messageName];
		}
	};

	// EXPORTED
	// removes all callbacks from the given message
	local.worker.removeAllNamedMessageListeners = function(messageName) {
		if (messageName in __messageListeners) {
			delete __messageListeners[messageName];
		}
	};

})();