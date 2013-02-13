(function(exports) {

	// ClientRegion
	// ============
	// EXPORTED
	// an isolated region of the DOM
	function ClientRegion(id) {
		this.id = id;
		this.context = {
			url   : '',
			urld  : {},
			links : [],
			type  : ''
		};

		this.element = document.getElementById(id);
		if (!this.element) { throw "ClientRegion target element not found"; }

		this.element.addEventListener('request', handleRequest.bind(this));
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

	function handleRequest(e) {
		e.preventDefault();
		e.stopPropagation();

		var request = e.detail;

		var url = request.url || request.host;
		// if (RegExp('^(http|httpl|https)://','i').test(url) === false) {
		// 	return;
		// }

		var self = this;
		this.__prepareRequest(request);
		promise(Environment.dispatch(this, request))
			.then(function(response) {
				self.__handleResponse(e, request, response);
			})
			.except(function(err) {
				self.__handleResponse(e, request, err.response);
			});
	}

	ClientRegion.prototype.__prepareRequest = function(request) {
		// sane defaults
		request.headers = request.headers || {};
		request.headers.accept = request.headers.accept || 'text/html';
		request.stream = false;

		// relative urls
		var urld = Link.parseUri(request);
		if (!urld.protocol) {
			// build a new url from the current context
			var newUrl = (this.context.url + request.url);
			// reduce the string's '..' relatives
			// :TODO: I'm sure there's a better algorithm for this
			var lastRequestHost = this.context.urld.host;
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
		this.context.urld  = urld;
		this.context.url   = urld.protocol + '://' + urld.authority + urld.directory;
		this.context.links = response.headers.link;
		this.context.type  = response.headers['content-type'];
	};

	ClientRegion.prototype.__handleResponse = function(e, request, response) {
		var requestTarget = this.__chooseRequestTarget(e, request);
		if (requestTarget == this.element)
			this.__updateContext(request, response);
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