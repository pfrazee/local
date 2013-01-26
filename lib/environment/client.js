(function(exports) {

	// ClientRegion
	// ============
	// EXPORTED
	// an isolated region of the DOM
	function ClientRegion(id) {
		this.contextUrl = ''; // used for relative links

		this.element = document.getElementById(id);
		if (!this.element) { throw "ClientRegion target element not found"; }

		this.__bindEventHandlers();
		CommonClient.listen(this.element);
	}

	ClientRegion.prototype.dispatchRequest = function(request) {
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

	ClientRegion.prototype.__bindEventHandlers = function() {
		this.listenerFn = (function(e) {
			e.preventDefault();
			e.stopPropagation();

			var request = e.detail;
			this.__reviewRequest(request);
			this.__contextualizeRequest(request);

			var self = this;
			promise(Environment.dispatch(this, request))
				.then(function(response) {
					self.__updateContext(request, response);
					response.on('end', function() { self.__handleResponse(e, request, response); });
				});
		}).bind(this);
		this.element.addEventListener('request', this.listenerFn);
	};

	ClientRegion.prototype.__reviewRequest = function(request) {
		// sane defaults
		request.headers = request.headers || {};
		request.headers.accept = request.headers.accept || 'text/html';
	};

	ClientRegion.prototype.__contextualizeRequest = function(request) {
		// relative urls
		var urld = Link.parseUri(request);
		if (!urld.protocol) {
			// build a new url from the current context
			var newUrl = (this.contextUrl + request.url);
			// reduce the string's '..' relatives
			// :TODO: I'm sure there's a better algorithm for this
			var lastRequestHost = Link.parseUri(this.contextUrl).host;
			do {
				request.url = newUrl;
				newUrl = request.url.replace(/[^\/]+\/\.\.\//i, '');
			} while (newUrl != request.url && Link.parseUri(newUrl).host == lastRequestHost);
			delete request.host;
			delete request.path;
		}
	};

	ClientRegion.prototype.__updateContext = function(request, response) {
		// track location for relative urls
		var urld = Link.parseUri(request);
		self.contextUrl = urld.protocol + '://' + urld.authority + urld.directory;
	};

	ClientRegion.prototype.__handleResponse = function(e, request, response) {
		var requestTarget = this.__chooseRequestTarget(e, request);
		CommonClient.handleResponse(requestTarget, this.element, response);
		Environment.postProcessRegion(requestTarget);
	};

	ClientRegion.prototype.__chooseRequestTarget = function(e, request) {
		if (e.target.tagName == 'OUTPUT') {
			return e.target;
		} else {
			return document.getElementById(request.target) || this.element;
		}
	};

	exports.ClientRegion = ClientRegion;
})(Environment);