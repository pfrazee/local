var promise = require('../promises.js').promise;
var helpers = require('./helpers.js');
var BridgeServer = require('./bridge-server.js');

// WorkerBridgeServer
// ==================
// EXPORTED
// wrapper for servers run within workers
// - `config.src`: optional URL, required unless `config.domain` is given
// - `config.domain`: optional hostname, required with a source-path unless `config.src` is given
// - `config.serverFn`: optional function to replace handleRemoteRequest
// - `config.shared`: boolean, should the workerserver be shared?
// - `config.namespace`: optional string, what should the shared worker be named?
//   - defaults to `config.src` if undefined
// - `config.temp`: optional bool, instructs the worker to self-destruct after its finished responding to its requests
// - `config.log`: optional bool, enables logging of all message traffic
function WorkerBridgeServer(config) {
	var self = this;
	if (!config || (!config.src && !config.domain))
		throw new Error("WorkerBridgeServer requires config with `src` or `domain` attribute.");
	BridgeServer.call(this, config);
	this.isActive = false; // when true, ready for activity
	this.hasHostPrivileges = true; // do we have full control over the worker?
	// ^ set to false by the ready message of a shared worker (if we're not the first page to connect)
	if (config.serverFn) {
		this.configServerFn = config.serverFn;
		delete this.config.serverFn; // clear out the function from config, so we dont get an error when we send config to the worker
	}

	var src_ = promise();
	if (config.src) {
		if (config.src.indexOf('blob:') === 0) {
			src_.fulfill(config.src);
		} else {
			loadScript(config.src);
		}
	}
	else if (config.domain) {
		// No src? Try fetching from sourcepath
		var domaind = helpers.parseUri(config.domain);
		if (domaind.srcPath) {
			// :WARN: in FF, Workers created by Blobs have been known to fail with a CSP script directive set
			// https://bugzilla.mozilla.org/show_bug.cgi?id=964276
			loadScript(helpers.joinUri(domaind.host, domaind.srcPath));
		} else {
			src_.reject(null);
			this.terminate(404, 'Worker Not Properly Constructed');
			throw "Worker incorrectly constructed without src or a domain with a source-path";
		}
	}

	function loadScript(url) {
		var urld = local.parseUri(url);
		if (!urld.authority || urld.authority == '.' || urld.authority.indexOf('.') === -1) {
			var dir = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'));
			var dirurl = window.location.protocol + '//' + window.location.hostname + dir;
			url = helpers.joinRelPath(dirurl, url);
		}
		var full_url = (!urld.protocol) ? 'https://'+url : url;
		local.GET(url)
			.fail(function(res) {
				if (!urld.protocol && (res.status === 0 || res.status == 404)) {
					// Not found? Try again without ssl
					full_url = 'http://'+url;
					return local.GET(full_url);
				}
				throw res;
			})
			.then(function(res) {
				// Create worker
				var bootstrap_src = require('../config.js').workerBootstrapScript;
				var script_blob = new Blob([bootstrap_src+'(function(){'+res.body+'; if (main) { self.main = main; }})();'], { type: "text/javascript" });
				src_.fulfill(window.URL.createObjectURL(script_blob));
			})
			.fail(function(res) {
				src_.reject(null);
				self.terminate(404, 'Worker Not Found');
			});
	}

	src_.then(function(src) {
		self.config.src = src;

		// Prep config
		if (!self.config.domain) { // assign a temporary label for logging if no domain is given yet
			self.config.domain = '<'+self.config.src.slice(0,40)+'>';
		}
		self.config.environmentHost = window.location.host; // :TODO: needed? I think workers can access this directly

		// Initialize the worker
		if (self.config.shared) {
			self.worker = new SharedWorker(src, config.namespace);
			self.worker.port.start();
		} else {
			self.worker = new Worker(src);
		}

		// Setup the incoming message handler
		self.getPort().addEventListener('message', function(event) {
			var message = event.data;
			if (!message)
				return console.error('Invalid message from worker: Payload missing', self, event);
			if (self.config.log) { self.debugLog('received from worker', message); }

			// Handle messages with an `op` field as worker-control packets rather than HTTPL messages
			switch (message.op) {
				case 'ready':
					// Worker can now accept commands
					self.onWorkerReady(message.body);
					break;
				case 'log':
					self.onWorkerLog(message.body);
					break;
				case 'terminate':
					self.terminate();
					break;
				default:
					// If no 'op' field is given, treat it as an HTTPL request and pass onto our BridgeServer parent method
					self.onChannelMessage(message);
					break;
			}
		});
	});
}
WorkerBridgeServer.prototype = Object.create(BridgeServer.prototype);
module.exports = WorkerBridgeServer;

// Returns the worker's messaging interface
// - varies between shared and normal workers
WorkerBridgeServer.prototype.getPort = function() {
	return this.worker.port ? this.worker.port : this.worker;
};

WorkerBridgeServer.prototype.terminate = function(status, reason) {
	BridgeServer.prototype.terminate.call(this, status, reason);
	if (this.worker) this.worker.terminate();
	if (this.config.src.indexOf('blob:') === 0) {
		window.URL.revokeObjectURL(this.config.src);
	}
	this.worker = null;
	this.isActive = false;
};

// Returns true if the channel is ready for activity
// - returns boolean
WorkerBridgeServer.prototype.isChannelActive = function() {
	return this.isActive;
};

// Sends a single message across the channel
// - `msg`: required string
WorkerBridgeServer.prototype.channelSendMsg = function(msg) {
	if (this.config.log) { this.debugLog('sending to worker', msg); }
	this.getPort().postMessage(msg);
};

// Remote request handler
// - should be overridden
WorkerBridgeServer.prototype.handleRemoteRequest = function(request, response) {
	var httpl = require('./httpl.js');
	if (this.configServerFn) {
		this.configServerFn.call(this, request, response, this);
	} else if (httpl.getServer('worker-bridge')) {
		var server = httpl.getServer('worker-bridge');
		server.fn.call(server.context, request, response, this);
	} else {
		response.writeHead(501, 'server not implemented');
		response.end();
	}
};

// Local request handler
WorkerBridgeServer.prototype.handleLocalRequest = function(request, response) {
	BridgeServer.prototype.handleLocalRequest.call(this, request, response);
	if (this.config.temp) {
		response.on('close', closeTempIfDone.bind(this));
	}
};

function closeTempIfDone() {
	if (!this.isActive) return;

	// Are we waiting on any streams from the worker?
	if (Object.keys(this.incomingStreams).length !== 0) {
		var Response = require('./response.js');
		// See if any of those streams are responses
		for (var sid in this.incomingStreams) {
			if (this.incomingStreams[sid] instanceof Response && this.incomingStreams[sid].isConnOpen) {
				// not done, worker still responding
				return;
			}
		}
	}

	// Done, terminate and remove worker
	console.log('Closing temporary worker', this.config.domain);
	this.terminate();
	require('./httpl').removeServer(this.config.domain);
}

// Starts normal functioning
// - called when the local.js signals that it has finished loading
WorkerBridgeServer.prototype.onWorkerReady = function(message) {
	this.hasHostPrivileges = message.hostPrivileges;
	if (this.hasHostPrivileges) {
		// Send config
		this.channelSendMsg({ op: 'configure', body: this.config });
	}
	this.isActive = true;
	this.flushBufferedMessages();
};

// Logs message data from the worker
WorkerBridgeServer.prototype.onWorkerLog = function(message) {
	if (!message)
		return;
	if (!Array.isArray(message))
		return console.error('Received invalid "log" operation: Payload must be an array', message);

	var type = message.shift();
	var args = ['['+this.config.domain+']'].concat(message);
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