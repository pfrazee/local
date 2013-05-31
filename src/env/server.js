// Env Servers
// ===========

(function() {
	var __cur_id = 1;
	function gen_id() { return __cur_id++; }

	// Server
	// ======
	// EXPORTED
	// core type for all servers, should be used as a prototype
	function Server() {
		this.config = { id:gen_id(), domain:null };
	}
	local.env.Server = Server;

	// request handler, should be overwritten by subclasses
	Server.prototype.handleHttpRequest = function(request, response) {
		response.writeHead(0, 'server not implemented');
		response.end();
	};

	// called before server destruction, should be overwritten by subclasses
	// - executes syncronously - does not wait for cleanup to finish
	Server.prototype.terminate = function() {
	};

	// retrieve server source
	// - `requester` is the object making the request
	Server.prototype.getSource = function(requester) {
		return this.handleHttpRequest.toString();
	};


	// WorkerServer
	// ============
	// EXPORTED
	// wrapper for servers run within workers
	// - `config.src`: required URL
	// - `loadCb`: optional function(message)
	function WorkerServer(config, loadCb) {
		config = config || {};
		Server.call(this);
		this.state = WorkerServer.BOOT;

		this.loadCb = loadCb;
		this.canLoadUserscript = false; // is the environment ready for us to load?

		// merge config
		for (var k in config)
			this.config[k] = config[k];

		// prep config
		if (!this.config.src)
			this.config.src = '';
		if (!this.config.srcBaseUrl) {
			if (/^data/.test(this.config.src) === false) // scriptBaseUrl is used for relative-path require()s in the worker
				this.config.srcBaseUrl = this.config.src.replace(/\/[^/]+$/,'/');
			else
				this.config.srcBaseUrl = '';
		}
		if (!this.config.domain) // assign a temporary label for logging if no domain is given yet
			this.config.domain = '<'+this.config.src.slice(0,40)+'>';
		this.config.environmentHost = window.location.host;

		// initialize the web worker with the bootstrap script
		this.worker = new local.env.Worker({ bootstrapUrl:local.env.config.workerBootstrapUrl });
		this.worker.suspendExchangeTopic('web_request'); // queue web requests until the app script is loaded
		this.worker.suspendExchangeTopic('web_subscribe'); // ditto for subscribes
		this.worker.onMessage(this.worker.ops, 'ready', this.onOpsWorkerReady.bind(this));
		this.worker.onMessage(this.worker.ops, 'log', this.onOpsWorkerLog.bind(this));
		this.worker.onMessage(this.worker.ops, 'terminate', this.terminate.bind(this));
		this.worker.onExchange('web_request', this.onWebRequestExchange.bind(this));
		this.worker.onExchange('web_subscribe', this.onWebSubscribeExchange.bind(this));

		// prebind some message handlers to `this` for reuse
		this.$onWebRequestHeaders   = this.onWebRequestHeaders.bind(this);
		this.$onWebRequestData      = this.onWebRequestData.bind(this);
		this.$onWebRequestEnd       = this.onWebRequestEnd.bind(this);
		this.$onWebResponseHeaders  = this.onWebResponseHeaders.bind(this);
		this.$onWebResponseData     = this.onWebResponseData.bind(this);
		this.$onWebResponseEnd      = this.onWebResponseEnd.bind(this);
		this.$onWebClose            = this.onWebClose.bind(this);
		this.$onWebSubscribeUrl     = this.onWebSubscribeUrl.bind(this);
		this.$onWebSubscribeChannel = this.onWebSubscribeChannel.bind(this);
		this.$onWebSubscribeClose   = this.onWebSubscribeClose.bind(this);
	}
	local.env.WorkerServer = WorkerServer;
	WorkerServer.prototype = Object.create(Server.prototype);

	// EXPORTED
	// possible states
	WorkerServer.BOOT   = 0; // initial, not ready to do work
	WorkerServer.READY  = 1; // local bootstrap is loaded, awaiting user script
	WorkerServer.ACTIVE = 2; // local bootstrap and user script loaded, server may handle requests
	WorkerServer.DEAD   = 3; // should be cleaned up


	// ops exchange handlers
	// -

	// runs Local initialization for a worker thread
	// - called when the bootstrap has finished loading
	WorkerServer.prototype.onOpsWorkerReady = function(message) {
		// disable dangerous APIs
		this.worker.nullify('XMLHttpRequest');
		this.worker.nullify('Worker');
		// hold onto the ready message and update state, so the environment can finish preparing us
		// (the config must be locked before we continue from here)
		this.state = WorkerServer.READY;
		if (this.canLoadUserscript)
			this.loadUserScript();
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


	// user script-loading api
	// -

	WorkerServer.prototype.loadUserScript = function() {
		this.canLoadUserscript = true; // flag that the environment is ready for us
		if (this.state != WorkerServer.READY)
			return; // wait for the worker to be ready

		this.worker.sendMessage(this.worker.ops, 'configure', this.config);

		// encode src in base64 if needed
		var src = this.config.src;
		if (src.indexOf('data:application/javascript,') === 0)
			src = 'data:application/javacsript;base64,'+btoa(src.slice(28));

		this.worker.importScripts(src, this.onWorkerUserScriptLoaded.bind(this));
	};

	// starts normal operation
	// - called when the user script has finished loading
	WorkerServer.prototype.onWorkerUserScriptLoaded = function(message) {
		if (this.loadCb && typeof this.loadCb == 'function')
			this.loadCb(message);
		if (message.data.error) {
			console.error('Failed to load user script in worker, terminating', message, this);
			this.terminate();
		}
		else if (this.state != WorkerServer.DEAD) {
			this.state = WorkerServer.ACTIVE;
			this.worker.resumeExchangeTopic('web_request');
			this.worker.resumeExchangeTopic('web_subscribe');
		}
	};


	// server behavior api
	// -

	// dispatches the request to the worker for handling
	// - called when a request is issued to the worker-server
	// - mirrors setRequestDispatcher(function) in worker/http.js
	WorkerServer.prototype.handleHttpRequest = function(request, response) {
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

	// retrieve server source
	// - `requester` is the object making the request
	WorkerServer.prototype.getSource = function(requester) {
		if (/^data/.test(this.config.src)) {
			var firstCommaIndex = this.config.src.indexOf(',');
			if (this.config.src.indexOf('data:application/javascript;base64,') === 0)
				return local.promise(atob(this.config.src.slice(firstCommaIndex+1) || ''));
			else
				return local.promise(this.config.src.slice(firstCommaIndex+1) || '');
		}

		// request from host
		var jsRequest = { method:'get', url:this.config.src, headers:{ accept:'application/javascript' }};
		return local.http.dispatch(jsRequest, requester).then(
			function(res) { return res.body; },
			function(res) {
				console.log('failed to retrieve worker source:', res);
				return '';
			}
		);
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
			self.worker.endExchange(message.exchange);
			return;
		}

		// create request
		var request = local.http.clientRequest(message.data);
		this.worker.setExchangeMeta(message.exchange, 'request', request);

		// dispatch request
		var worker = this.worker;
		local.http.dispatch(request, this).always(function(response) {
			worker.setExchangeMeta(message.exchange, 'response', response);

			// wire response into the exchange
			worker.sendMessage(message.exchange, 'response_headers', response);
			response.on('data', function(data) { worker.sendMessage(message.exchange, 'response_data', data); });
			response.on('end', function() {
				worker.sendMessage(message.exchange, 'response_end');
				worker.endExchange(message.exchange);
			});
		});
	};

	WorkerServer.prototype.onWebRequestData = function(message) {
		if (!message.data || typeof message.data != 'string') {
			console.error('Invalid "request_data" message from worker: Payload must be a string', message);
			self.worker.endExchange(message.exchange);
			return;
		}

		var request = this.worker.getExchangeMeta(message.exchange, 'request');
		if (!request) {
			console.error('Invalid "request_data" message from worker: Request headers not previously received', message);
			self.worker.endExchange(message.exchange);
			return;
		}

		request.write(message.data);
	};

	WorkerServer.prototype.onWebRequestEnd = function(message) {
		var request = this.worker.getExchangeMeta(message.exchange, 'request');
		if (!request) {
			console.error('Invalid "request_end" message from worker: Request headers not previously received', message);
			self.worker.endExchange(message.exchange);
			return;
		}

		request.end();
	};

	WorkerServer.prototype.onWebResponseHeaders = function(message) {
		if (!message.data) {
			console.error('Invalid "response_headers" message from worker: Payload missing', message);
			self.worker.endExchange(message.exchange);
			return;
		}

		var response = this.worker.getExchangeMeta(message.exchange, 'response');
		if (!response) {
			console.error('Internal error when receiving "response_headers" message from worker: Response object not present', message);
			self.worker.endExchange(message.exchange);
			return;
		}

		response.writeHead(message.data.status, message.data.reason, message.data.headers);
	};

	WorkerServer.prototype.onWebResponseData = function(message) {
		if (!message.data || typeof message.data != 'string') {
			console.error('Invalid "response_data" message from worker: Payload must be a string', message);
			self.worker.endExchange(message.exchange);
			return;
		}

		var response = this.worker.getExchangeMeta(message.exchange, 'response');
		if (!response) {
			console.error('Internal error when receiving "response_data" message from worker: Response object not present', message);
			self.worker.endExchange(message.exchange);
			return;
		}

		response.write(message.data);
	};

	WorkerServer.prototype.onWebResponseEnd = function(message) {
		var response = this.worker.getExchangeMeta(message.exchange, 'response');
		if (!response) {
			console.error('Internal error when receiving "response_end" message from worker: Response object not present', message);
			self.worker.endExchange(message.exchange);
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
		if (request) request.close();
		var response = this.worker.getExchangeMeta(message.exchange, 'response');
		if (response) response.close();
	};



	// web subscribe exchange handlers
	// -

	// routes the subscribe to local.http and sends the events back to the worker
	// - called when the worker-server issues a subscribe
	// - sadly, cant just wrap this around dispatch() because the remote-source version
	//   uses browser-native functions instead of dispatch()
	WorkerServer.prototype.onWebSubscribeExchange = function(exchange) {
		this.worker.onMessage(exchange, 'subscribe_url', this.$onWebSubscribeUrl);
		this.worker.onMessage(exchange, 'subscribe_channel', this.$onWebSubscribeChannel);
		this.worker.onMessage(exchange, 'close', this.$onWebSubscribeClose);
	};

	WorkerServer.prototype.onWebSubscribeUrl = function(message) {
		if (!message.data || typeof message.data != 'string') {
			console.error('Invalid "subscribe_url" message from worker: Payload must be a url', message);
			self.worker.endExchange(message.exchange);
			return;
		}

		var eventStream = local.http.subscribe(message.data);
		self.worker.setExchangeMeta(message.exchange, 'eventStream', eventStream);
	};

	WorkerServer.prototype.onWebSubscribeChannel = function(message) {
		if (!message.data) {
			console.error('Invalid "subscribe_channel" message from worker: Payload must be a string or array of strings', message);
			self.worker.endExchange(message.exchange);
			return;
		}

		var eventStream = self.worker.getExchangeMeta(message.exchange, 'eventStream');
		if (!eventStream) {
			console.error('Invalid "subscribe_channel" message from worker: EventStream not previously established', message);
			self.worker.endExchange(message.exchange);
			return;
		}

		var self = this;
		eventStream.on(message.data, function(e) {
			self.worker.sendMessage(message.exchange, 'subscribe_event', e);
		});
	};

	WorkerServer.prototype.onWebSubscribeClose = function(message) {
		var eventStream = self.worker.getExchangeMeta(message.exchange, 'eventStream');
		if (eventStream) eventStream.close();
	};
})();