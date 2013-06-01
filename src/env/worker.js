// Env Worker
// ==========

(function () {
	var __cur_cid = 1;
	function gen_cid() { return __cur_cid++; }
	var __cur_mid = 1;
	function gen_mid() { return __cur_mid++; }

	// Worker
	// ======
	// EXPORTED
	// wraps a Web Worker API tools for sandboxing and messaging
	// - loads the worker with the bootstrap script
	// - `options.bootstrapUrl` may optionally specify the URL of the worker bootstrap script
	// - `options.log` will enable logging of traffic
	function LocalEnvWorker(options) {
		options = options || {};
		this.isLogging = options.log;

		this.exchanges = {};
		this.exchangeListeners = {};

		// operations stream - open by default on both ends
		this.ops = 0;
		this.exchanges[this.ops] = { topic: null, messageListeners: {} };

		// suspension
		this.suspendedTopics = [];
		this.messageBuffers = {};

		this.worker = new Worker(options.bootstrapUrl || 'worker.js');
		setupMessagingHandlers.call(this);
	}
	local.env.Worker = LocalEnvWorker;


	// control api
	// -

	// EXPORTED
	// instructs the LocalEnvWorker to set the given name to null
	// - eg LocalEnvWorker.nullify('XMLHttpRequest'); // no ajax
	LocalEnvWorker.prototype.nullify = function(name) {
		this.sendMessage(this.ops, 'nullify', name);
	};

	// EXPORTED
	// instructs the LocalEnvWorker to import the JS given by the URL
	// - eg LocalEnvWorker.importJS('/my/script.js', onImported);
	// - `urls`: required string|array[string]
	// - `cb`: optional function(message), called on load/fail
	// - `urls` may contain data-urls of valid JS
	LocalEnvWorker.prototype.importScripts = function(urls, cb) {
		var exImportScripts = this.startExchange('importScripts');
		if (cb)
			this.onMessage(exImportScripts, 'done', cb);
		this.sendMessage(exImportScripts, 'urls', urls);
		// exImportScripts will be closed by the worker after sending 'done'
	};

	// EXPORTED
	// destroys the LocalEnvWorker
	LocalEnvWorker.prototype.terminate = function() {
		delete this.exchanges;
		delete this.exchangeListeners;
		delete this.suspendedTopics;
		delete this.messageBuffers;
		this.worker.terminate();
		this.worker = null;
	};


	// exchange & messaging api
	// -

	// INTERNAL
	// registers listeners required for messaging
	function setupMessagingHandlers() {
		// native message handler
		this.worker.addEventListener('message', (function(event) {
			var message = event.data;
			if (!message)
				return console.error('Invalid message from worker: Payload missing', message);
			if (typeof message.id == 'undefined')
				return console.error('Invalid message from worker: `id` missing', message);
			if (typeof message.exchange == 'undefined')
				return console.error('Invalid message from worker: `exchange` missing', message);
			if (!message.label)
				return console.error('Invalid message from worker: `label` missing', message);

			if (this.isLogging) { console.log('receiving', message); }

			// exchanges from the worker use negative IDs (to avoid collisions)
			message.exchange = parseInt(message.exchange, 10);
			if (message.exchange !== this.ops) // (except the ops channel)
				message.exchange = -message.exchange;

			// notify onMessage listeners
			emitOnMessage.call(this, message);
		}).bind(this));

		// new exchange handler
		this.onMessage(this.ops, 'open_exchange', (function(message) {
			if (!message.data)
				return console.error('Invalid ops-exchange "open_exchange" message from worker: Payload missing', message);
			if (!message.data.topic)
				return console.error('Invalid ops-exchange "open_exchange" message from worker: `topic` missing', message);
			if (typeof message.data.exchange == 'undefined')
				return console.error('Invalid ops-exchange "open_exchange" message from worker: `exchange` missing', message);

			if (this.isLogging) { console.log('open exchange', message); }

			// exchanges from the worker use negative IDs (to avoid collisions)
			message.data.exchange = -parseInt(message.data.exchange, 10);
			this.exchanges[message.data.exchange] = { topic: message.data.topic, messageListeners: {}, metaData: {} };

			// notify onExchange listeners
			emitOnExchange.call(this, message.data.topic, message.data.exchange);
		}).bind(this));

		// end exchange handler
		this.onMessage(this.ops, 'close_exchange', (function(message) {
			var exchange = -parseInt(message.data, 10);
			if (exchange === 0)
				return console.error('Invalid ops-exchange "close_exchange" message from worker: Cannot close "ops" exchange', message);
			else if (!exchange)
				return console.error('Invalid ops-exchange "close_exchange" message from worker: Payload missing', message);
			if (!(exchange in this.exchanges))
				return console.error('Invalid ops-exchange "close_exchange" message from worker: Invalid exchange id', message);

			if (this.isLogging) { console.log('close exchange', message); }

			this.removeAllMessageListeners(exchange);
			delete this.exchanges[exchange];
			if (exchange in this.messageBuffers)
				delete this.messageBuffers[exchange];
		}).bind(this));
	}

	// EXPORTED
	// starts a new bidirectional message stream
	// - sends the 'open_exchange' message on the operations exchange
	// - `topic`: required string, a label for the exchange
	LocalEnvWorker.prototype.startExchange = function(topic) {
		var exchange = gen_cid();
		this.exchanges[exchange] = { topic: topic, messageListeners: {}, metaData: {} };
		this.sendMessage(this.ops, 'open_exchange', { exchange: exchange, topic: topic });

		if (this.isExchangeTopicSuspended(topic))
			this.suspendExchange(exchange);

		return exchange;
	};

	// EXPORTED
	// ends the message stream, signaling the close on the other end
	// - sends the 'close_exchange' message on the operations exchange
	//   and 'close' on the given exchange, and broadcasts the 'close' message
	//   on the local exchange listeners
	// - `exchange`: required number, an ID given by `startExchange()` or `onExchange()`
	LocalEnvWorker.prototype.endExchange = function(exchange) {
		if (!(exchange in this.exchanges))
			return;

		// broadcast 'close' locally
		emitOnMessage.call(this, {
			id       : gen_mid(),
			exchange : exchange,
			label    : 'close'
		});

		this.sendMessage(exchange, 'close');
		this.sendMessage(this.ops, 'close_exchange', exchange);

		this.removeAllMessageListeners(exchange);
		delete this.exchanges[exchange];
		if (exchange in this.messageBuffers)
			delete this.messageBuffers[exchange];
	};

	// EXPORTED
	// adds data to the exchange to be used in callbacks
	// - `exchange`: required number
	// - `k`: required string
	// - `v`: required mixed
	LocalEnvWorker.prototype.setExchangeMeta = function(exchange, k, v) {
		if (exchange in this.exchanges)
			this.exchanges[exchange].metaData[k] = v;
	};

	// EXPORTED
	// gets data from the exchange
	// - `exchange`: required number
	// - `k`: required string
	LocalEnvWorker.prototype.getExchangeMeta = function(exchange, k, v) {
		if (exchange in this.exchanges)
			return this.exchanges[exchange].metaData[k];
		return null;
	};

	// EXPORTED
	// sends a message on an established exchange stream
	// - `exchange`: required number, an ID given by `startExchange()` or `onExchange()`
	// - `label`: required string, identifies the message type
	// - `data`: optional mixed, the content of the message
	LocalEnvWorker.prototype.sendMessage = function(exchange, label, data) {
		var message;
		if (typeof exchange == 'object')
			message = exchange;
		else {
			message = {
				id       : gen_mid(),
				exchange : exchange,
				label    : label,
				data     : data
			};
		}
		if (message.exchange in this.messageBuffers) {
			// dont send; queue message in the buffer
			this.messageBuffers[message.exchange].push(message);
		} else {
			if (this.isLogging) { console.log('sending', message); }
			this.worker.postMessage(message);
		}
		return message.id;
	};

	// EXPORTED
	// registers a callback for handling new exchanges from the worker
	// - `topic`: required string, the exchange label
	// - `handler`: required function(exchange:number)
	LocalEnvWorker.prototype.onExchange = function(topic, handler) {
		if (!(topic in this.exchangeListeners))
			this.exchangeListeners[topic] = [];
		this.exchangeListeners[topic].push(handler);
	};

	// INTERNAL
	// calls 'new exchange' listeners
	function emitOnExchange(topic, exchange) {
		var listeners = this.exchangeListeners[topic];
		if (listeners) {
			listeners.forEach(function(listener) {
				listener(exchange);
			});
		}
	}

	// EXPORTED
	// removes a callback from the converation topic
	// - `topic`: required string, the exchange label
	// - `handler`: required function, the callback to remove
	LocalEnvWorker.prototype.removeExchangeListener = function(topic, handler) {
		if (topic in this.exchangeListeners) {
			var filterFn = function(listener) { return listener != handler; };
			this.exchangeListeners[topic] = this.exchangeListeners[topic].filter(filterFn);
			if (this.exchangeListeners[topic].length === 0)
				delete this.exchangeListeners[topic];
		}
	};

	// EXPORTED
	// removes all callbacks from the exchange topic
	// - `topic`: required string, the exchange label
	LocalEnvWorker.prototype.removeAllExchangeListeners = function(topic) {
		if (topic in this.exchangeListeners)
			delete this.exchangeListeners[topic];
	};

	// EXPORTED
	// signals a new message on an established exchange stream
	// - `exchange`: required number, an ID given by `startExchange()` or `onExchange()`
	// - `label`: required string, identifies the message type
	// - `handler`: required function(message:object, exchangeData:object)
	LocalEnvWorker.prototype.onMessage = function(exchange, label, handler) {
		var exchangeData = this.exchanges[exchange];
		if (!exchangeData)
			return console.error('Invalid `exchange` in onMessage() call: Not a valid ID', exchange);

		if (!(label in exchangeData.messageListeners))
			exchangeData.messageListeners[label] = [];
		exchangeData.messageListeners[label].push(handler);
	};

	// INTERNAL
	// calls 'on message' listeners
	function emitOnMessage(message) {
		if (message.exchange in this.exchanges) {
			var listeners = this.exchanges[message.exchange].messageListeners;
			if (message.label in listeners) {
				listeners[message.label].forEach(function(listener) {
					listener(message);
				});
			}
		}
	}

	// EXPORTED
	// removes a callback from a exchange's message listeners
	// - `exchange`: required number
	// - `label`: required string
	// - `handler`: required function
	LocalEnvWorker.prototype.removeMessageListener = function(exchange, label, handler) {
		var exchangeData = this.exchanges[exchange];
		if (!exchangeData)
			return console.warn('Invalid `exchange` in removeMessageListener() call: Not a valid ID', exchange);

		if (label in exchangeData.messageListeners) {
			var filterFn = function(listener) { return listener != handler; };
			exchangeData.messageListeners[label] = exchangeData.messageListeners[label].filter(filterFn);
			if (exchangeData.messageListeners[label].length === 0)
				delete exchangeData.messageListeners[label];
		}
	};

	// EXPORTED
	// - `exchange`: required number
	// - `label`: optional string
	// - if `label` is not given, removes all message listeners on the exchange
	LocalEnvWorker.prototype.removeAllMessageListeners = function(exchange, label) {
		var exchangeData = this.exchanges[exchange];
		if (!exchangeData)
			return console.warn('Invalid `exchange` in removeMessageListener() call: Not a valid ID', exchange);

		if (label) {
			if (label in exchangeData.messageListeners)
				delete exchangeData.messageListeners[label];
		} else
			exchangeData.messageListeners = {};
	};

	// EXPORTED
	// delays all messages of the given exchange until `resumeExchange` is called
	// - `exchange`: required number
	LocalEnvWorker.prototype.suspendExchange = function(exchange) {
		if (!(exchange in this.messageBuffers))
			this.messageBuffers[exchange] = [];
	};

	// EXPORTED
	// stops buffering and sends all queued messages in the exchange
	// - `exchange`: required number
	LocalEnvWorker.prototype.resumeExchange = function(exchange) {
		if (exchange in this.messageBuffers) {
			var buffer = this.messageBuffers[exchange];
			delete this.messageBuffers[exchange];
			buffer.forEach(this.sendMessage, this);
		}
	};

	// EXPORTED
	// - `exchange`: required number
	LocalEnvWorker.prototype.isExchangeSuspended = function(exchange) {
		return (exchange in this.messageBuffers);
	};

	// EXPORTED
	// delays all messages of the given exchange topic until `resumeExchangeTopic` is called
	// - `topic`: required string
	// - only suspends outgoing topics (not incoming)
	LocalEnvWorker.prototype.suspendExchangeTopic = function(topic) {
		if (this.suspendedTopics.indexOf(topic) === -1) {
			this.suspendedTopics.push(topic);
			for (var c in this.exchanges) {
				if (this.exchanges[c].topic == topic)
					this.suspendExchange(c);
			}
		}
	};

	// EXPORTED
	// stops buffering and sends all queued messages in the exchanges of the given `topic`
	// - `topic`: required string
	LocalEnvWorker.prototype.resumeExchangeTopic = function(topic) {
		var topicIndex = this.suspendedTopics.indexOf(topic);
		if (topicIndex !== -1) {
			this.suspendedTopics.splice(topicIndex, 1);
			for (var c in this.exchanges) {
				if (this.exchanges[c].topic == topic)
					this.resumeExchange(c);
			}
		}
	};

	// EXPORTED
	// - `topic`: required string
	LocalEnvWorker.prototype.isExchangeTopicSuspended = function(topic) {
		return this.suspendedTopics.indexOf(topic) !== -1;
	};
})();