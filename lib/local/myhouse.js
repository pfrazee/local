// MyHouse
// =======
// pfraze 2012
var MyHouse = {};

(function (exports) {
	var cur_mid = 1;
	function gen_mid() { return cur_mid++; }

	// Sandbox
	// =======
	// EXPORTED
	// wraps a Web Worker API tools for sandboxing and messaging
	// - should be used by the environment hosting the workers (most likely the document)
	// - loads the worker with the MyHouse bootstrap script
	// - `options.bootstrapUrl` may optionally specify the URL of MyHouse's worker bootstrap script
	// - `options.log` will enable logging of traffic
	function Sandbox(readyCb, options) {
		options = options || {};
		this.isLogging = options.log;

		this.messageListeners = {};
		this.replyCbs = {};
		this.messageBuffers = {};

		if (readyCb) {
			this.onMessage('ready', readyCb, this);
		}

		this.worker = new Worker(options.bootstrapUrl || 'worker-bootstrap.js');
		setupMessagingHandlers.call(this);
	}

	// INTERNAL
	// registers listeners required for messaging
	function setupMessagingHandlers() {
		var self = this;
		this.worker.addEventListener('message', function(event) {
			var message = event.data;
			if (this.isLogging) { console.log('receiving', message); }

			// handle replies
			if (message.name === 'reply') {
				var cb = self.replyCbs[message.reply_to];
				if (cb) {
					cb.func.call(cb.context, message);
					delete self.replyCbs[message.reply_to]; // wont need to call again
					return;
				}
			}

			var listeners = self.messageListeners[message.name];

			// streaming
			if (message.name === 'endMessage') {
				var mid = message.data;
				listeners = self.messageListeners[mid]; // inform message listeners
				self.removeAllMessageListeners(mid); // and release their references
			}

			// dispatch
			if (listeners) {
				listeners.forEach(function(listener) {
					listener.func.call(listener.context, message);
				});
			}
		});
	}

	// EXPORTED
	// sends a message to the sandbox
	// - `messageName` is required
	// - returns id of the new message
	// - if `replyCb` is specified, it will be called once if/when the sandbox sends a reply to the message
	// - to send more data afterwards (streaming) use the returned id as the message name
	Sandbox.prototype.postMessage = function(messageName, messageData, replyCb, replyCbContext) {
		var message = makeMessage(messageName, messageData);
		doPostMessage.call(this, message, replyCb, replyCbContext);
		return message.id;
	};

	// EXPORTED
	// sends a reply to a message from the sandbox
	// - parameter 1 (`orgMessage`) should be the message (or id of the message) originally received from the sandbox
	// - otherwise works exactly like postMessage
	// - NOTE: replies will only be handled by replyCbs registered during the original send
	//   - if a sender is not expecting a reply, it will never be handled
	Sandbox.prototype.postReply = function(orgMessage, messageData, replyCb, replyCbContext) {
		var replyToID = (typeof orgMessage === 'object') ? orgMessage.id : orgMessage;
		var message = makeMessage('reply', messageData, replyToID);
		doPostMessage.call(this, message, replyCb, replyCbContext);
		return message.id;
	};

	// EXPORTED
	// informs the receiver that no more data will stream, allowing it to release its listeners
	// - parameter 1 (`orgMessageID`) should be the first message's id (returned by postMessage/postReply)
	Sandbox.prototype.endMessage = function(orgMessageID) {
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
	// - should be called with the Sandbox bound to `this`
	function doPostMessage(message, replyCb, replyCbContext) {
		if (message.name in this.messageBuffers) {
			// dont send; queue message in the buffer
			this.messageBuffers[message.name].push([message, replyCb, replyCbContext]);
		} else {
			if (replyCb && typeof replyCb === 'function') {
				this.replyCbs[message.id] = { func:replyCb, context:replyCbContext };
			}
			if (this.isLogging) { console.log('sending', message); }
			this.worker.postMessage(message);
		}
	}

	// EXPORTED
	// registers a callback to handle messages from the sandbox
	// - `messageName` and `func` are required
	Sandbox.prototype.addMessageListener = function(messageName, func, context) {
		if (!(messageName in this.messageListeners)) {
			// create new listener array
			this.messageListeners[messageName] = [];
		}
		// add to list
		this.messageListeners[messageName].push({ func:func, context:context });
	};
	Sandbox.prototype.onMessage = Sandbox.prototype.addMessageListener;

	// EXPORTED
	// removes a given callback from the message listeners
	Sandbox.prototype.removeMessageListener = function(messageName, func) {
		if (messageName in this.messageListeners) {
			// filter out the listener
			var filterFn = function(listener) { return listener.func != func; };
			this.messageListeners[messageName] = this.messageListeners[messageName].filter(filterFn);
			// remove array if empty
			if (this.messageListeners[messageName].length === 0) {
				delete this.messageListeners[messageName];
			}
		}
	};

	// EXPORTED
	// removes all callbacks from the given message
	Sandbox.prototype.removeAllMessageListeners = function(messageName) {
		if (messageName in this.messageListeners) {
			delete this.messageListeners[messageName];
		}
	};

	// EXPORTED
	// delays all messages of the given type until `releaseMessages` is called
	Sandbox.prototype.bufferMessages = function(messageName) {
		if (!(messageName in this.messageBuffers)) {
			this.messageBuffers[messageName] = [];
		}
	};

	// EXPORTED
	// stops buffering and sends all queued messages
	Sandbox.prototype.releaseMessages = function(messageName) {
		if (messageName in this.messageBuffers) {
			var buffers = this.messageBuffers[messageName];
			delete this.messageBuffers[messageName]; // clear the entry, so `doPostMessage` knows to send
			buffers.forEach(function(buffer) {
				doPostMessage.apply(this, buffer);
			}, this);
		}
	};

	// EXPORTED
	// instructs the sandbox to set the given name to null
	// - eg sandbox.nullify('XMLHttpRequest'); // no ajax
	Sandbox.prototype.nullify = function(name) {
		this.postMessage('nullify', name);
	};

	// EXPORTED
	// instructs the sandbox to import the JS given by the URL
	// - eg sandbox.importJS('/my/script.js', onImported);
	// - urls may be a string or an array of strings
	// - note, `urls` may contain data-urls of valid JS
	// - `cb` is called with the respond message
	//   - on error, .data will be { error:true, reason:'message' }
	Sandbox.prototype.importScripts = function(urls, cb) {
		this.postMessage('importScripts', urls, cb);
	};

	// EXPORTED
	// destroys the sandbox
	Sandbox.prototype.terminate = function() {
		// just to be safe about callbacks, lets drop all our listeners
		// :TODO: does this do anything?
		var k; // just shut up, JSLint
		for (k in this.messageListeners) {
			delete this.messageListeners[k];
		}
		for (k in this.replyCbs) {
			delete this.replyCbs[k];
		}
		// kill the worker
		this.worker.terminate();
		this.worker = null;
	};

	exports.Sandbox = Sandbox;

})(MyHouse);

// set up for node or AMD
if (typeof module !== "undefined") {
	module.exports = MyHouse;
}
else if (typeof define !== "undefined") {
	define([], function() {
		return MyHouse;
	});
}