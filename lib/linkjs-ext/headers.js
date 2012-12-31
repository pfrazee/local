// Headers
// =======
// extends linkjs
// a utility for building request and response headers
// pfraze 2012

(function (exports) {
	
	// Headers
	// =======
	// a utility for building request and response headers
	// - may be passed to `response.writeHead()`
	function Headers(init) {
		// copy out any initial values
		if (init && typeof init == 'object') {
			for (var k in init) {
				if (init.hasOwnProperty(k)) {
					this[k] = init[k];
				}
			}
		}
	}

	// adds an entry to the Link header
	// - `href` may be a relative path for the context's domain
	// - `rel` should be a value found in http://www.iana.org/assignments/link-relations/link-relations.xml
	// - `rel` may contain more than on value, separated by spaces
	// - `other` is an optional object of other KVs for the header
	Headers.prototype.addLink = function(href, rel, other) {
		var entry = other || {};
		entry.href = href;
		entry.rel = rel;
		if (!this.link) {
			this.link = [];
		}
		this.link.push(entry);
	};

	// wrap helper
	function headers(h) {
		return (h instanceof Headers) ? h : new Headers(h);
	}

	exports.Headers = Headers;
	exports.headers = headers;
})(Link);