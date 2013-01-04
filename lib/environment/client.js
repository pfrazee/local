(function(exports) {

	// Client
	// ======
	// EXPORTED
	// an isolated region of the DOM
	function Client(id) {
		this.context = null;

		this.element = document.getElementById(id);
		if (!this.element) { throw "Client target element not found"; }
		bindEventHandlers.call(this);
		CommonClient.listen(this.element);
	}

	function bindEventHandlers() {
		var self = this;
		this.element.addEventListener('request', function(e) {
			var request = e.detail;

			// sane defaults
			request.headers = request.headers || {};
			request.headers.accept = request.headers.accept || 'text/html';

			// choose the request target
			var requestTarget;
			if (e.target.tagName == 'OUTPUT') {
				requestTarget = e.target;
			} else {
				requestTarget = document.getElementById(request.target) || self.element;
			}

			// issue request
			promise(Environment.request(self, request))
				.then(function(res) {
					// success, send back to common client
					res.on('end', function() {
						CommonClient.handleResponse(requestTarget, self.element, res);
						Environment.postProcessRegion(requestTarget);
					});
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
})(Environment);