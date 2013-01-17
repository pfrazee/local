(function(exports) {

	// ClientRegion
	// ============
	// EXPORTED
	// an isolated region of the DOM
	function ClientRegion(id) {
		this.context = null;
		this.lastRequestLocation = ''; // used for relative links

		this.element = document.getElementById(id);
		if (!this.element) { throw "ClientRegion target element not found"; }
		bindEventHandlers.call(this);
		CommonClient.listen(this.element);
	}

	function bindEventHandlers() {
		this.listenerFn = (function(e) {
			var request = e.detail;

			// sane defaults
			request.headers = request.headers || {};
			request.headers.accept = request.headers.accept || 'text/html';

			// relative urls
			var urld = Link.parseUri(request);
			if (!urld.protocol) {
				// build a new url from the current context
				var newUrl = (this.lastRequestLocation + request.url);
                console.log('rel', this.lastRequestLocation, newUrl);
				// reduce the string's '..' relatives
				// :TODO: I'm sure there's a better algorithm for this
				var lastRequestHost = Link.parseUri(this.lastRequestLocation).host;
				do {
					request.url = newUrl;
					newUrl = request.url.replace(/[^\/]+\/\.\.\//i, '');
				} while (newUrl != request.url && Link.parseUri(newUrl).host == lastRequestHost);
				delete request.host;
				delete request.path;
			}

			// choose the request target
			var requestTarget;
			if (e.target.tagName == 'OUTPUT') {
				requestTarget = e.target;
			} else {
				requestTarget = document.getElementById(request.target) || this.element;
			}

			// issue request
            var self = this;
			promise(Environment.request(this, request))
				.then(function(res) {
					// track location for relative urls
					var urld = Link.parseUri(request);
					self.lastRequestLocation = urld.protocol + '://' + urld.authority + urld.directory;
					// success, send back to common client
					res.on('end', function() {
						CommonClient.handleResponse(requestTarget, this.element, res);
						Environment.postProcessRegion(requestTarget);
					});
				});
			e.preventDefault();
			e.stopPropagation();
		}).bind(this);
		this.element.addEventListener('request', this.listenerFn);
	}

	ClientRegion.prototype.request = function(request) {
		if (typeof request === 'string') {
			request = { method:'get', url:request, headers:{ accept:'text/html' }};
		}
		var re = new CustomEvent('request', { bubbles:true, cancelable:true, detail:request });
		this.element.dispatchEvent(re);
	};

	ClientRegion.prototype.terminate = function() {
		CommonClient.unlisten(this);
		this.element.removeEventListener('request', this.listenerFn);
	};

	exports.ClientRegion = ClientRegion;
})(Environment);