(function() {

	// PageServer
	// ==========
	// EXPORTED
	// wraps the comm interface to a page for messaging
	// - `id`: required number, should be the index of the connection in the list
	// - `port`: required object, either `self` (for non-shared workers) or a port from `onconnect`
	// - `isHost`: boolean, should connection get host privileges?
	function PageServer(id, port, isHost) {
		local.BridgeServer.call(this);
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
				case 'terminate':
					this.terminate();
					break;
				default:
					// If no recognized 'op' field is given, treat it as an HTTPL request and pass onto our BridgeServer parent method
					this.onChannelMessage(message);
					break;
			}
		}).bind(this));
	}
	PageServer.prototype = Object.create(local.BridgeServer.prototype);
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
	PageServer.prototype.handleRemoteRequest = function(request, response) {
		var server = local.worker.serverFn;
		if (server && typeof server == 'function') {
			server.call(this, request, response, this);
		} else if (server && server.handleRemoteRequest) {
			server.handleRemoteRequest(request, response, this);
		} else {
			response.writeHead(500, 'not implemented');
			response.end();
		}
	};

	// Stores configuration sent by the page
	PageServer.prototype.onPageConfigure = function(message) {
		if (!this.isHostPage) {
			console.log('rejected "configure" from non-host connection');
			return;
		}
		local.worker.config = message;
	};

})();