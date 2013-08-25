(function () {
	var __cur_cid = 1;
	function gen_cid() { return __cur_cid++; }
	var __cur_mid = 1;
	function gen_mid() { return __cur_mid++; }

	// WorkerExchangeWrapper
	// =====================
	// EXPORTED
	// wraps a Web Worker with the exchange protocol (for multiplexing) and with lowlevel control protocols
	// - loads the worker with the bootstrap script
	// - `options.bootstrapUrl` may optionally specify the URL of the worker bootstrap script
	// - `options.log` will enable logging of all message traffic
	// - `options.shared` will use SharedWorker instead of WebWorker
	// - `options.namespace` will set the `name` of SharedWorker, if applicable
	function WorkerExchangeWrapper(options) {
		options = options || {};
		this.isLogging = options.log;
		this.isShared = options.shared;

		this.exchanges = {};
		this.exchangeListeners = {};

		// operations stream - open by default on both ends
		this.ops = 0;
		this.exchanges[this.ops] = { topic: null, messageListeners: {} };

		// suspension
		this.suspendedTopics = [];
		this.messageBuffers = {};

		if (this.isShared) {
			this.worker = new SharedWorker(options.bootstrapUrl || 'worker.js', options.namespace);
			this.worker.port.start();
		} else
			this.worker = new Worker(options.bootstrapUrl || 'worker.js');
		setupMessagingHandlers.call(this);
	}
	local.web.WorkerExchangeWrapper = WorkerExchangeWrapper;

	WorkerExchangeWrapper.prototype.getPort = function() {
		return this.worker.port ? this.worker.port : this.worker;
	};


	// control api
	// -

	// EXPORTED
	// instructs the WorkerExchangeWrapper to set the given name to null
	// - eg WorkerExchangeWrapper.nullify('XMLHttpRequest'); // no ajax
	WorkerExchangeWrapper.prototype.nullify = function(name) {
		this.sendMessage(this.ops, 'nullify', name);
	};

	// EXPORTED
	// instructs the WorkerExchangeWrapper to import the JS given by the URL
	// - eg WorkerExchangeWrapper.importJS('/my/script.js', onImported);
	// - `urls`: required string|array[string]
	// - `cb`: optional function(message), called on load/fail
	// - `urls` may contain data-urls of valid JS
	WorkerExchangeWrapper.prototype.importScripts = function(urls, cb) {
		var exImportScripts = this.startExchange('importScripts');
		if (cb)
			this.onMessage(exImportScripts, 'done', cb);
		this.sendMessage(exImportScripts, 'urls', urls);
		// exImportScripts will be closed by the worker after sending 'done'
	};

	// EXPORTED
	// destroys the WorkerExchangeWrapper
	WorkerExchangeWrapper.prototype.terminate = function() {
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
		this.getPort().addEventListener('message', (function(event) {
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
	WorkerExchangeWrapper.prototype.startExchange = function(topic) {
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
	WorkerExchangeWrapper.prototype.endExchange = function(exchange) {
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
	WorkerExchangeWrapper.prototype.setExchangeMeta = function(exchange, k, v) {
		if (exchange in this.exchanges)
			this.exchanges[exchange].metaData[k] = v;
	};

	// EXPORTED
	// gets data from the exchange
	// - `exchange`: required number
	// - `k`: required string
	WorkerExchangeWrapper.prototype.getExchangeMeta = function(exchange, k, v) {
		if (exchange in this.exchanges)
			return this.exchanges[exchange].metaData[k];
		return null;
	};

	// EXPORTED
	// sends a message on an established exchange stream
	// - `exchange`: required number, an ID given by `startExchange()` or `onExchange()`
	// - `label`: required string, identifies the message type
	// - `data`: optional mixed, the content of the message
	WorkerExchangeWrapper.prototype.sendMessage = function(exchange, label, data) {
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
			this.getPort().postMessage(message);
		}
		return message.id;
	};

	// EXPORTED
	// registers a callback for handling new exchanges from the worker
	// - `topic`: required string, the exchange label
	// - `handler`: required function(exchange:number)
	WorkerExchangeWrapper.prototype.onExchange = function(topic, handler) {
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
	WorkerExchangeWrapper.prototype.removeExchangeListener = function(topic, handler) {
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
	WorkerExchangeWrapper.prototype.removeAllExchangeListeners = function(topic) {
		if (topic in this.exchangeListeners)
			delete this.exchangeListeners[topic];
	};

	// EXPORTED
	// signals a new message on an established exchange stream
	// - `exchange`: required number, an ID given by `startExchange()` or `onExchange()`
	// - `label`: required string, identifies the message type
	// - `handler`: required function(message:object, exchangeData:object)
	WorkerExchangeWrapper.prototype.onMessage = function(exchange, label, handler) {
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
	WorkerExchangeWrapper.prototype.removeMessageListener = function(exchange, label, handler) {
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
	WorkerExchangeWrapper.prototype.removeAllMessageListeners = function(exchange, label) {
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
	WorkerExchangeWrapper.prototype.suspendExchange = function(exchange) {
		if (!(exchange in this.messageBuffers))
			this.messageBuffers[exchange] = [];
	};

	// EXPORTED
	// stops buffering and sends all queued messages in the exchange
	// - `exchange`: required number
	WorkerExchangeWrapper.prototype.resumeExchange = function(exchange) {
		if (exchange in this.messageBuffers) {
			var buffer = this.messageBuffers[exchange];
			delete this.messageBuffers[exchange];
			buffer.forEach(this.sendMessage, this);
		}
	};

	// EXPORTED
	// - `exchange`: required number
	WorkerExchangeWrapper.prototype.isExchangeSuspended = function(exchange) {
		return (exchange in this.messageBuffers);
	};

	// EXPORTED
	// delays all messages of the given exchange topic until `resumeExchangeTopic` is called
	// - `topic`: required string
	// - only suspends outgoing topics (not incoming)
	WorkerExchangeWrapper.prototype.suspendExchangeTopic = function(topic) {
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
	WorkerExchangeWrapper.prototype.resumeExchangeTopic = function(topic) {
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
	WorkerExchangeWrapper.prototype.isExchangeTopicSuspended = function(topic) {
		return this.suspendedTopics.indexOf(topic) !== -1;
	};


	// WorkerServer
	// ============
	// EXPORTED
	// wrapper for servers run within workers
	// - `config.src`: required URL
	// - `config.shared`: boolean, should the workerserver be shared?
	// - `config.namespace`: optional string, what should the shared worker be named?
	//   - defaults to `config.src` if undefined
	// - `loadCb`: optional function(message)
	function WorkerServer(config, loadCb) {
		if (!config || !config.src)
			throw "WorkerServer requires config with `src` attribute.";

		local.web.Server.call(this, config);
		this.hasHostPrivileges = true; // do we have full control over the worker?
		// ^ set to false by the ready message of a shared worker (if we're not the first page to connect)
		this.loadCb = loadCb;

		// Prep config
		if (!this.config.domain) // assign a temporary label for logging if no domain is given yet
			this.config.domain = '<'+this.config.src.slice(0,40)+'>';
		this.config.environmentHost = window.location.host;

		// initialize the web worker with the bootstrap script
		this.worker = new WorkerExchangeWrapper({
			bootstrapUrl: local.workerBootstrapUrl,
			shared: config.shared || false,
			namespace: config.namespace || config.src
		});
		this.worker.suspendExchangeTopic('web_request'); // queue web requests until the app script is loaded
		this.worker.suspendExchangeTopic('web_subscribe'); // ditto for subscribes
		this.worker.onMessage(this.worker.ops, 'ready', this.onOpsWorkerReady.bind(this));
		this.worker.onMessage(this.worker.ops, 'log', this.onOpsWorkerLog.bind(this));
		this.worker.onMessage(this.worker.ops, 'terminate', this.terminate.bind(this));
		this.worker.onExchange('web_request', this.onWebRequestExchange.bind(this));

		// prebind some message handlers to `this` for reuse
		this.$onWebRequestHeaders   = this.onWebRequestHeaders.bind(this);
		this.$onWebRequestData      = this.onWebRequestData.bind(this);
		this.$onWebRequestEnd       = this.onWebRequestEnd.bind(this);
		this.$onWebResponseHeaders  = this.onWebResponseHeaders.bind(this);
		this.$onWebResponseData     = this.onWebResponseData.bind(this);
		this.$onWebResponseEnd      = this.onWebResponseEnd.bind(this);
		this.$onWebClose            = this.onWebClose.bind(this);
	}
	local.web.WorkerServer = WorkerServer;
	WorkerServer.prototype = Object.create(local.web.Server.prototype);


	// ops exchange handlers
	// -

	// Sends initialization commands
	// - called when the bootstrap has finished loading
	WorkerServer.prototype.onOpsWorkerReady = function(message) {
		this.hasHostPrivileges = message.data.hostPrivileges;
		if (this.hasHostPrivileges) {
			// Disable dangerous APIs
			this.worker.nullify('XMLHttpRequest');
			this.worker.nullify('Worker');

			// Load user script
			var src = this.config.src;
			if (src.indexOf('data:application/javascript,') === 0)
				src = 'data:application/javacsript;base64,'+btoa(src.slice(28));
			this.worker.sendMessage(this.worker.ops, 'configure', this.config);
			this.worker.importScripts(src, this.onWorkerUserScriptLoaded.bind(this));
		} else {
			this.onWorkerUserScriptLoaded();
		}
	};

	// logs message data from the worker
	WorkerServer.prototype.onOpsWorkerLog = function(message) {
		if (!message.data)
			return;
		if (!Array.isArray(message.data))
			return console.error('Received invalid ops-exchange "log" message: Payload must be an array', message);

		var type = message.data.shift();
		var args = ['['+this.config.domain+']'].concat(message.data);
		switch (type) {
			case 'error':
				console.error.apply(console, args);
				break;
			case 'warn':
				console.warn.apply(console, args);
				break;
			default:
				console.log.apply(console, args);
				break;
		}
	};

	// destroys the server
	// - called when the worker has died, or when the environment wants the server to die
	WorkerServer.prototype.terminate = function() {
		this.state = WorkerServer.DEAD;
		this.worker.terminate();
	};

	// starts normal operation
	// - called when the user script has finished loading
	WorkerServer.prototype.onWorkerUserScriptLoaded = function(message) {
		if (this.loadCb && typeof this.loadCb == 'function')
			this.loadCb(message);
		if (message && message.data.error) {
			console.error('Failed to load user script in worker, terminating', message, this);
			this.terminate();
		}
		else {
			this.worker.resumeExchangeTopic('web_request');
			this.worker.resumeExchangeTopic('web_subscribe');
		}
	};


	// server behavior api
	// -

	// dispatches the request to the worker for handling
	// - called when a request is issued to the worker-server
	// - mirrors setRequestDispatcher(function) in worker/http.js
	WorkerServer.prototype.handleWebRequest = function(request, response) {
		var worker = this.worker;

		// setup exchange and exchange handlers
		var exchange = worker.startExchange('web_request');
		worker.setExchangeMeta(exchange, 'request', request);
		worker.setExchangeMeta(exchange, 'response', response);
		worker.onMessage(exchange, 'response_headers', this.$onWebResponseHeaders);
		worker.onMessage(exchange, 'response_data', this.$onWebResponseData);
		worker.onMessage(exchange, 'response_end', this.$onWebResponseEnd);
		worker.onMessage(exchange, 'close', this.$onWebClose);

		// wire request into the exchange
		worker.sendMessage(exchange, 'request_headers', request);
		request.on('data', function(data) { worker.sendMessage(exchange, 'request_data', data); });
		request.on('end', function() { worker.sendMessage(exchange, 'request_end'); });
	};


	// web request exchange handlers
	// -

	// dispatches a request to local.http and sends the response back to the worker
	// - called when the worker-server issues a request
	// - mirrors app.onExchange('web_request') in worker/http.js
	WorkerServer.prototype.onWebRequestExchange = function(exchange) {
		this.worker.onMessage(exchange, 'request_headers', this.$onWebRequestHeaders);
		this.worker.onMessage(exchange, 'request_data', this.$onWebRequestData);
		this.worker.onMessage(exchange, 'request_end', this.$onWebRequestEnd);
		this.worker.onMessage(exchange, 'close', this.$onWebClose);
	};

	WorkerServer.prototype.onWebRequestHeaders = function(message) {
		if (!message.data) {
			console.error('Invalid "request_headers" message from worker: Payload missing', message);
			this.worker.endExchange(message.exchange);
			return;
		}

		// create request
		var request = new local.web.Request(message.data);
		this.worker.setExchangeMeta(message.exchange, 'request', request);

		// dispatch request
		var worker = this.worker;
		request.stream = true; // we always want streaming so we can wire up to the data & end events
		local.web.dispatch(request, this).always(function(response) {
			worker.setExchangeMeta(message.exchange, 'response', response);

			// wire response into the exchange
			worker.sendMessage(message.exchange, 'response_headers', response);
			response.on('data', function(data) { worker.sendMessage(message.exchange, 'response_data', data); });
			response.on('end', function() { worker.sendMessage(message.exchange, 'response_end'); });
			response.on('close', function() { worker.endExchange(message.exchange); });
		});
	};

	WorkerServer.prototype.onWebRequestData = function(message) {
		var request = this.worker.getExchangeMeta(message.exchange, 'request');
		if (!request) {
			console.error('Invalid "request_data" message from worker: Request headers not previously received', message);
			this.worker.endExchange(message.exchange);
			return;
		}

		request.write(message.data);
	};

	WorkerServer.prototype.onWebRequestEnd = function(message) {
		var request = this.worker.getExchangeMeta(message.exchange, 'request');
		if (!request) {
			console.error('Invalid "request_end" message from worker: Request headers not previously received', message);
			this.worker.endExchange(message.exchange);
			return;
		}

		request.end();
	};

	WorkerServer.prototype.onWebResponseHeaders = function(message) {
		if (!message.data) {
			console.error('Invalid "response_headers" message from worker: Payload missing', message);
			this.worker.endExchange(message.exchange);
			return;
		}

		var response = this.worker.getExchangeMeta(message.exchange, 'response');
		if (!response) {
			console.error('Internal error when receiving "response_headers" message from worker: Response object not present', message);
			this.worker.endExchange(message.exchange);
			return;
		}

		response.writeHead(message.data.status, message.data.reason, message.data.headers);
	};

	WorkerServer.prototype.onWebResponseData = function(message) {
		var response = this.worker.getExchangeMeta(message.exchange, 'response');
		if (!response) {
			console.error('Internal error when receiving "response_data" message from worker: Response object not present', message);
			this.worker.endExchange(message.exchange);
			return;
		}

		response.write(message.data);
	};

	WorkerServer.prototype.onWebResponseEnd = function(message) {
		var response = this.worker.getExchangeMeta(message.exchange, 'response');
		if (!response) {
			console.error('Internal error when receiving "response_end" message from worker: Response object not present', message);
			this.worker.endExchange(message.exchange);
			return;
		}

		response.end();
	};

	// closes the request/response, caused by a close of the exchange
	// - could happen because the response has ended
	// - could also happen because the request aborted
	// - could also happen due to a bad message
	WorkerServer.prototype.onWebClose = function(message) {
		var request = this.worker.getExchangeMeta(message.exchange, 'request');
		var response = this.worker.getExchangeMeta(message.exchange, 'response');
		if (request) request.close();
		if (response) response.close();
	};
})();