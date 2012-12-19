(function(exports) {

	// Client
	// ======
	// EXPORTED
	// an isolated region of the DOM
	function Client(elemSelector) {
		this.context = null;

		this.element = document.querySelector(elemSelector);
		if (!this.element) { throw "Client target element not found"; }
		bindEventHandlers.call(this);
		CommonClient.listen(this.element);
	}

	function bindEventHandlers() {
		var self = this;
		this.element.addEventListener('request', function(e) {
			var request = e.detail;
			Link.request(request.payload, request, function(data, headers) {
				var requestTarget = document.getElementById(request.target) || self.element;
				CommonClient.handleResponse(requestTarget, self.element, data, headers);
			}, function(data, headers) {
				console.log('Error:',headers.status, headers.reason, e.detail);
			});
			e.preventDefault();
			e.stopPropagation();
		});
	}

	Client.prototype.request = function(request) {
		if (typeof request === 'string') {
			request = { method:'get', url:request, headers:{ accept:'text/html' }};
		}
		var re = new CustomEvent('request', { bubbles:true, cancelable:true, detail:request });
		this.element.dispatchEvent(re);
	};

	Client.prototype.terminate = function() {
		// :TODO:
		// CommonClient.unlisten(this);
	};

	exports.Client = Client;
})(App);