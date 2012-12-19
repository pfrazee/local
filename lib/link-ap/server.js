(function(exports) {
	var cur_pid = 1;
	function gen_pid() { return cur_pid++; }

	// Server
	// ======
	// EXPORTED
	// wrapper for user applications
	function Server(scriptUrl) {
		this.config = Object.freeze({
			pid       : gen_pid(),
			scriptUrl : scriptUrl
		});
		this.state = Server.BOOT;

		this.worker = new MyHouse.Sandbox();
		this.worker.onMessage('ready', this.onWorkerReady, this);
		this.worker.onMessage('loaded', this.onWorkerLoaded, this);
		this.worker.onMessage('terminate', this.terminate, this);
		this.worker.onMessage('httpRequest', this.onWorkerHttpRequest, this);
	}

	// EXPORTED
	// possible states
	Server.BOOT   = 0;
	Server.READY  = 1;
	Server.ACTIVE = 2;
	Server.DEAD   = 3;

	Server.prototype.onWorkerReady = function(message) {
		this.state = Server.READY;
		this.worker.postReply(message, { pid:this.config.pid });
		this.worker.importScripts('/lib/worker_core.js'); 
		this.worker.nullify('XMLHttpRequest'); // disable ajax
		this.worker.importScripts(this.scriptUrl); // load the program
	};

	Server.prototype.onWorkerLoaded = function(message) {
		this.state = Server.ACTIVE;
	};

	Server.prototype.terminate = function() {
		this.state = Server.DEAD;
		this.worker.terminate();
	};

	Server.prototype.onWorkerHttpRequest = function(message) {
		// :TODO: streaming
		var sendResponse = function(data, headers) {
			this.worker.postReply(message, { status:headers.status, reason:headers.reason, headers:headers, payload:data });
		};
		Link.request(message.data.payload, message.data, sendResponse, sendResponse);
	};

	Server.prototype.postHttpRequestMessage = function(request, response) {
		var firstResponse = true;
		this.worker.postMessage('httpRequest', request, function(reply) {
			if (!reply.data) { throw "Invalid reply to httpRequest from worker"; }
			if (firstResponse) {
				// first response is always headers
				response.writeHead(reply.data.status, reply.data.reason);
			}
			// pull in any newly-set headers
			if (reply.data.headers) {
				for (var k in reply.data.headers) {
					reply.setHeader(k, headers[k]);
				}
			}
			// write the response body
			if (reply.payload) {
				if (reply.isOpen) {
					response.write(reply.payload);
				} else {
					response.end(reply.payload);
				}
			}
		}, this);
	};
})(App);