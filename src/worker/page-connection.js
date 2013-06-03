// Worker Named Messaging
// ======================

(function() {
	var __cur_cid = 1;
	function gen_cid() { return __cur_cid++; }
	var __cur_mid = 1;
	function gen_mid() { return __cur_mid++; }

	// PageConnection
	// ==============
	// EXPORTED
	// wraps the comm interface to a page for messaging
	// - `port`: required object, either `self` (for non-shared workers) or a port from `onconnect`
	// - `isHost`: boolean, should connection get host privileges?
	function PageConnection(port, isHost) {
		this.port = port;
		this.isHostConnection = isHost;

		this.exchanges = {};
		this.exchangeListeners = {};

		// operations stream - open by default on both ends
		this.ops = 0;
		this.exchanges[this.ops] = { topic: null, messageListeners: {} };

		setupMessagingHandlers.call(this);
		if (isHost)
			setupHostOpsHandlers.call(this);
	}
	local.worker.PageConnection = PageConnection;


	// messaging api
	// -

	// INTERNAL
	// registers listeners required for messaging
	function setupMessagingHandlers() {
		// native message handler
		this.port.addEventListener('message', (function(event) {
			var message = event.data;
			if (!message)
				return console.error('Invalid message from page: Payload missing', message);
			if (typeof message.id == 'undefined')
				return console.error('Invalid message from page: `id` missing', message);
			if (typeof message.exchange == 'undefined')
				return console.error('Invalid message from page: `exchange` missing', message);
			if (!message.label)
				return console.error('Invalid message from page: `label` missing', message);

			// exchanges from the page use negative IDs (to avoid collisions)
			message.exchange = parseInt(message.exchange, 10);
			if (message.exchange !== this.ops) // (except the ops channel)
				message.exchange = -message.exchange;

			// notify onMessage listeners
			emitOnMessage.call(this, message);
		}).bind(this));

		// new exchange handler
		this.onMessage(this.ops, 'open_exchange', (function(message) {
			if (!message.data)
				return console.error('Invalid ops-exchange "open_exchange" message from page: Payload missing', message);
			if (!message.data.topic)
				return console.error('Invalid ops-exchange "open_exchange" message from page: `topic` missing', message);
			if (typeof message.data.exchange == 'undefined')
				return console.error('Invalid ops-exchange "open_exchange" message from page: `exchange` missing', message);

			// exchanges from the page use negative IDs (to avoid collisions)
			message.data.exchange = -parseInt(message.data.exchange, 10);
			this.exchanges[message.data.exchange] = { topic: message.data.topic, messageListeners: {}, metaData: {} };

			// notify onExchange listeners
			emitOnExchange.call(this, message.data.topic, message.data.exchange);
		}).bind(this));

		// end exchange handler
		this.onMessage(this.ops, 'close_exchange', (function(message) {
			var exchange = -parseInt(message.data, 10);
			if (exchange === 0)
				return console.error('Invalid ops-exchange "close_exchange" message from page: Cannot close "ops" exchange', message);
			else if (!exchange)
				return console.error('Invalid ops-exchange "close_exchange" message from page: Payload missing', message);
			if (!(exchange in this.exchanges))
				return console.error('Invalid ops-exchange "close_exchange" message from page: Invalid exchange id', message);

			this.removeAllMessageListeners(exchange);
			delete this.exchanges[exchange];
		}).bind(this));
	}

	// INTERNAL
	// registers listeners for host-privileged ops messages
	function setupHostOpsHandlers() {
		var conn = this;
		conn.onMessage(conn.ops, 'configure', function(message) {
			local.worker.config = message.data;
		});

		conn.onMessage(conn.ops, 'nullify', function(message) {
			console.log('nullifying: ' + message.data);
			if (typeof message.data === 'string')
				self[message.data] = null; // destroy the top-level reference
			else
				throw "'nullify' message must include a valid string";
		});

		conn.onExchange('importScripts', function(exchange) {
			conn.onMessage(exchange, 'urls', function(message) {
				console.log('importingScripts: ' + message.data);
				if (message && message.data) {
					try {
						closureImportScripts(message.data);
					} catch(e) {
						console.error((e ? e.toString() : e), (e ? e.stack : e));
						conn.sendMessage(message.exchange, 'done', { error: true, reason: (e ? e.toString() : e) });
						conn.endExchange(message.exchange);
						return;
					}
				} else {
					console.error("'importScripts' message must include a valid array/string");
					conn.sendMessage(message.exchange, 'done', { error: true, reason: (e ? e.toString() : e) });
					conn.endExchange(message.exchange);
					return;
				}
				conn.sendMessage(message.exchange, 'done', { error: false });
				conn.endExchange(message.exchange);
			});
		});
	}

	// EXPORTED
	// starts a new bidirectional message stream
	// - sends the 'open_exchange' message on the operations exchange
	// - `topic`: required string, a label for the exchange
	PageConnection.prototype.startExchange = function(topic) {
		var exchange = gen_cid();
		this.exchanges[exchange] = { topic: topic, messageListeners: {}, metaData: {} };
		this.sendMessage(this.ops, 'open_exchange', { exchange: exchange, topic: topic });
		return exchange;
	};

	// EXPORTED
	// ends the message stream, signaling the close on the other end
	// - sends the 'close_exchange' message on the operations exchange
	//   and 'close' on the given exchange, and broadcasts the 'close' message
	//   on the local exchange listeners
	// - `exchange`: required number, an ID given by `startExchange()` or `onExchange()`
	PageConnection.prototype.endExchange = function(exchange) {
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
	};

	// EXPORTED
	// adds data to the exchange to be used in callbacks
	// - `exchange`: required number
	// - `k`: required string
	// - `v`: required mixed
	PageConnection.prototype.setExchangeMeta = function(exchange, k, v) {
		if (exchange in this.exchanges)
			this.exchanges[exchange].metaData[k] = v;
	};

	// EXPORTED
	// gets data from the exchange
	// - `exchange`: required number
	// - `k`: required string
	PageConnection.prototype.getExchangeMeta = function(exchange, k, v) {
		if (exchange in this.exchanges)
			return this.exchanges[exchange].metaData[k];
		return null;
	};

	// EXPORTED
	// sends a message on an established exchange stream
	// - `exchange`: required number, an ID given by `startExchange()` or `onExchange()`
	// - `label`: required string, identifies the message type
	// - `data`: optional mixed, the content of the message
	PageConnection.prototype.sendMessage = function(exchange, label, data) {
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
		this.port.postMessage(message);
		return message.id;
	};

	// EXPORTED
	// registers a callback for handling new exchanges from the worker
	// - `topic`: required string, the exchange label
	// - `handler`: required function(exchange:number)
	PageConnection.prototype.onExchange = function(topic, handler) {
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
	PageConnection.prototype.removeExchangeListener = function(topic, handler) {
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
	PageConnection.prototype.removeAllExchangeListeners = function(topic) {
		if (topic in this.exchangeListeners)
			delete this.exchangeListeners[topic];
	};

	// EXPORTED
	// signals a new message on an established exchange stream
	// - `exchange`: required number, an ID given by `startExchange()` or `onExchange()`
	// - `label`: required string, identifies the message type
	// - `handler`: required function(message:object, exchangeData:object)
	PageConnection.prototype.onMessage = function(exchange, label, handler) {
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
	PageConnection.prototype.removeMessageListener = function(exchange, label, handler) {
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
	PageConnection.prototype.removeAllMessageListeners = function(exchange, label) {
		var exchangeData = this.exchanges[exchange];
		if (!exchangeData)
			return console.warn('Invalid `exchange` in removeMessageListener() call: Not a valid ID', exchange);

		if (label) {
			if (label in exchangeData.messageListeners)
				delete exchangeData.messageListeners[label];
		} else
			exchangeData.messageListeners = {};
	};

})();