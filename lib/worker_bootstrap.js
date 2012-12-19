// MyHouse
// =======
// pfraze 2012

typeof Sandbox === 'undefined' ? (function() {
	// keeps the current message id, used for tracking messages
	var cur_mid = 1;
	function gen_mid() { return cur_mid++; }

	// Sandbox
	// =======
	// GLOBAL
	// provides messaging tools to the host environment
	self.Sandbox = {
		replyCbs         : {},
		messageListeners : {}
	};

	// INTERNAL
	// message receive handler
	self.addEventListener('message', function(event) {		
		var message = event.data;
		// handle replies
		if (message.name === 'reply') {
			var cb = Sandbox.replyCbs[message.reply_to];
			if (cb) {
				cb.func.call(cb.context, message);
				delete Sandbox.replyCbs[message.reply_to]; // wont need to call again
				return;
			}
		}

		// dispatch to standard listeners
		var listeners = Sandbox.messageListeners[message.name];
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
	Sandbox.postMessage = function(messageName, messageData, replyCb, replyCbContext) {
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
	Sandbox.postReply  = function(orgMessage, messageData, replyCb, replyCbContext) {
		var replyToID = (typeof orgMessage === 'object') ? orgMessage.id : orgMessage;
		var message = makeMessage('reply', messageData, replyToID);
		doPostMessage(message, replyCb, replyCbContext);
		return message.id;
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
			Sandbox.replyCbs[message.id] = { func:replyCb, context:replyCbContext };
		}
		// post
		self.postMessage(message);
	}

	// EXPORTED
	// registers a callback to handle messages from the sandbox
	// - `messageName` and `func` are required
	Sandbox.addMessageListener = function(messageName, func, context) {
		if (!(messageName in Sandbox.messageListeners)) {
			// create new listener array
			Sandbox.messageListeners[messageName] = [];
		}
		// add to list
		Sandbox.messageListeners[messageName].push({ func:func, context:context });
	};
	Sandbox.onMessage = Sandbox.addMessageListener;

	// EXPORTED
	// removes a given callback from the message listeners
	Sandbox.removeMessageListener = function(messageName, func) {
		if (messageName in Sandbox.messageListeners) {
			// filter out the listener
			var filterFn = function(listener) { return listener.func != func; };
			Sandbox.messageListeners[messageName] = Sandbox.messageListeners[messageName].filter(filterFn);
			// remove array if empty
			if (Sandbox.messageListeners[messageName].length === 0) {
				delete Sandbox.messageListeners[messageName];
			}
		}
	};

	// EXPORTED
	// removes all callbacks from the given message
	Sandbox.removeAllMessageListeners = function(messageName) {
		if (messageName in Sandbox.messageListeners) {
			delete Sandbox.messageListeners[messageName];
		}
	};

	// INTERNAL
	// removes an object from use
	Sandbox.onMessage('nullify', function(message) {
		Sandbox.postMessage('log', 'nullifying: ' + message.data);
		if (message && typeof message.data === 'string') {
			// destroy the top-level reference
			self[message.data] = null;
		} else {
			Sandbox.postReply(message, { error:"'nullify' message must include a valid string" });
		}
	});

	// INTERNAL
	Sandbox.onMessage('importScripts', function(message) {
		Sandbox.postMessage('log', 'importingScripts: ' + message.data);
		if (message && message.data) {
			self.importScripts(message.data);
		} else {
			Sandbox.postReply(message, { error:"'importScripts' message must include a valid array/string" });
		}
	});

	// let the parent know we've loaded
	Sandbox.postMessage('ready');
})() : null;