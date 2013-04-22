// Env Worker
// ==========

(function () {
	var __cur_mid = 1;
	function gen_mid() { return __cur_mid++; }

	// Worker
	// ======
	// EXPORTED
	// wraps a Web Worker API tools for sandboxing and messaging
	// - should be used by the environment hosting the workers (most likely the document)
	// - loads the worker with the bootstrap script
	// - `options.bootstrapUrl` may optionally specify the URL of the worker bootstrap script
	// - `options.log` will enable logging of traffic
	function LocalEnvWorker(readyCb, options) {
		options = options || {};
		this.isLogging = options.log;

		this.messageListeners = {};
		this.replyCbs = {};
		this.messageBuffers = {};

		if (readyCb)
			this.onNamedMessage('ready', readyCb, this);

		this.worker = new Worker(options.bootstrapUrl || 'worker.js');
		setupMessagingHandlers.call(this);
	}
	local.env.Worker = LocalEnvWorker;

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
				self.removeAllNamedMessageListeners(mid); // and release their references
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
	// sends a message to the LocalEnvWorker
	// - `messageName` is required
	// - returns id of the new message
	// - if `replyCb` is specified, it will be called once if/when the LocalEnvWorker sends a reply to the message
	// - to send more data afterwards (streaming) use the returned id as the message name
	LocalEnvWorker.prototype.postNamedMessage = function(messageName, messageData, replyCb, replyCbContext) {
		var message = makeMessage(messageName, messageData);
		doPostMessage.call(this, message, replyCb, replyCbContext);
		return message.id;
	};

	// EXPORTED
	// sends a reply to a message from the LocalEnvWorker
	// - parameter 1 (`orgMessage`) should be the message (or id of the message) originally received from the LocalEnvWorker
	// - otherwise works exactly like postNamedMessage
	// - NOTE: replies will only be handled by replyCbs registered during the original send
	//   - if a sender is not expecting a reply, it will never be handled
	LocalEnvWorker.prototype.postReply = function(orgMessage, messageData, replyCb, replyCbContext) {
		var replyToID = (typeof orgMessage === 'object') ? orgMessage.id : orgMessage;
		var message = makeMessage('reply', messageData, replyToID);
		doPostMessage.call(this, message, replyCb, replyCbContext);
		return message.id;
	};

	// EXPORTED
	// informs the receiver that no more data will stream, allowing it to release its listeners
	// - parameter 1 (`orgMessageID`) should be the first message's id (returned by postNamedMessage/postReply)
	LocalEnvWorker.prototype.endMessage = function(orgMessageID) {
		return this.postNamedMessage('endMessage', orgMessageID);
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
	// - should be called with the LocalEnvWorker bound to `this`
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
	// registers a callback to handle messages from the LocalEnvWorker
	// - `messageName` and `func` are required
	LocalEnvWorker.prototype.addNamedMessageListener = function(messageName, func, context) {
		if (!(messageName in this.messageListeners)) {
			// create new listener array
			this.messageListeners[messageName] = [];
		}
		// add to list
		this.messageListeners[messageName].push({ func:func, context:context });
	};
	LocalEnvWorker.prototype.onNamedMessage = LocalEnvWorker.prototype.addNamedMessageListener;

	// EXPORTED
	// removes a given callback from the message listeners
	LocalEnvWorker.prototype.removeNamedMessageListener = function(messageName, func) {
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
	LocalEnvWorker.prototype.removeAllNamedMessageListeners = function(messageName) {
		if (messageName in this.messageListeners) {
			delete this.messageListeners[messageName];
		}
	};

	// EXPORTED
	// delays all messages of the given type until `releaseMessages` is called
	LocalEnvWorker.prototype.bufferMessages = function(messageName) {
		if (!(messageName in this.messageBuffers)) {
			this.messageBuffers[messageName] = [];
		}
	};

	// EXPORTED
	// stops buffering and sends all queued messages
	LocalEnvWorker.prototype.releaseMessages = function(messageName) {
		if (messageName in this.messageBuffers) {
			var buffers = this.messageBuffers[messageName];
			delete this.messageBuffers[messageName]; // clear the entry, so `doPostMessage` knows to send
			buffers.forEach(function(buffer) {
				doPostMessage.apply(this, buffer);
			}, this);
		}
	};

	// EXPORTED
	// instructs the LocalEnvWorker to set the given name to null
	// - eg LocalEnvWorker.nullify('XMLHttpRequest'); // no ajax
	LocalEnvWorker.prototype.nullify = function(name) {
		this.postNamedMessage('nullify', name);
	};

	// EXPORTED
	// instructs the LocalEnvWorker to import the JS given by the URL
	// - eg LocalEnvWorker.importJS('/my/script.js', onImported);
	// - urls may be a string or an array of strings
	// - note, `urls` may contain data-urls of valid JS
	// - `cb` is called with the respond message
	//   - on error, .data will be { error:true, reason:'message' }
	LocalEnvWorker.prototype.importScripts = function(urls, cb) {
		this.postNamedMessage('importScripts', urls, cb);
	};

	// EXPORTED
	// destroys the LocalEnvWorker
	LocalEnvWorker.prototype.terminate = function() {
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
})();