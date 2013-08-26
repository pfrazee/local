(function() {

	// PageServer
	// ==========
	// EXPORTED
	// wraps the comm interface to a page for messaging
	// - `id`: required number, should be the index of the connection in the list
	// - `port`: required object, either `self` (for non-shared workers) or a port from `onconnect`
	// - `isHost`: boolean, should connection get host privileges?
	function PageServer(id, port, isHost) {
		local.web.BridgeServer.call(this);
		this.id = id;
		this.port = port;
		this.isHostPage = isHost;

		// Setup the incoming message handler
		this.port.addEventListener('message', (function(event) {
			var message = event.data;
			if (!message)
				return console.error('Invalid message from page: Payload missing', event);

			// Handle messages with an `op` field as worker-control packets rather than HTTPL messages
			switch (message.op) {
				case 'configure':
					this.onPageConfigure(message.body);
					break;
				case 'nullify':
					this.onPageNullify(message.body);
					break;
				case 'importScripts':
					this.onPageImportScripts(message.body);
					break;
				case 'terminate':
					this.terminate();
					break;
				default:
					// If no 'op' field is given, treat it as an HTTPL request and pass onto our BridgeServer parent method
					this.onChannelMessage(message);
					break;
			}
		}).bind(this));
	}
	PageServer.prototype = Object.create(local.web.BridgeServer.prototype);
	local.worker.PageServer = PageServer;

	// Returns true if the channel is ready for activity
	// - returns boolean
	PageServer.prototype.isChannelActive = function() {
		return true;
	};

	// Sends a single message across the channel
	// - `msg`: required string
	PageServer.prototype.channelSendMsg = function(msg) {
		this.port.postMessage(msg);
	};

	// Remote request handler
	PageServer.prototype.handleRemoteWebRequest = function(request, response) {
		if (main) {
			main(request, response, this);
		} else {
			response.writeHead(500, 'worker main() not implemented');
			response.end();
		}
	};

	// Stores configuration sent by the page
	PageServer.prototype.onPageConfigure = function(message) {
		if (!this.isHostPage) {
			console.log('rejected "configure" from non-host connection');
			return;
		}
		self.config = local.worker.config = message;
	};

	// Nullifies a global
	PageServer.prototype.onPageNullify = function(message) {
		if (!this.isHostPage) {
			console.log('rejected "nullify" from non-host connection');
			return;
		}
		console.log('nullifying: ' + message);
		if (typeof message === 'string') {
			self[message] = null; // destroy the top-level reference
		} else {
			throw "'nullify' message must include a valid string";
		}
	};

	// Imports a user-script
	PageServer.prototype.onPageImportScripts = function(message) {
		if (!this.isHostPage) {
			console.log('rejected "importScripts" from non-host connection');
			return;
		}
		if (message) {
			try {
				closureImportScripts(message);
			} catch(e) {
				console.error((e ? e.toString() : e), (e ? e.stack : e));
				this.channelSendMsg({ op: 'loaded', body: { error: true, reason: (e ? e.toString() : e) }});
				return;
			}
		} else {
			console.error("'importScripts' message must include a valid array/string");
			this.channelSendMsg({ op: 'loaded', body: { error: true, reason: 'No script URI provided' }});
			return;
		}
		this.channelSendMsg({ op: 'loaded', body: { error: false }});
	};

})();