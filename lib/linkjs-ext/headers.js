// Headers
// =======
// extends linkjs
// a utility for building request and response headers
// pfraze 2012

(function (exports) {
	
	// Headerer
	// ========
	// a utility for building request and response headers
	// - may be passed to `response.writeHead()`
	function Headerer(init) {
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
	Headerer.prototype.addLink = function(href, rel, other) {
		var entry = other || {};
		entry.href = href;
		entry.rel = rel;
		if (!this.link) {
			this.link = [];
		}
		this.link.push(entry);
	};

	// sets the Auth header
	// - `auth` must include a `scheme`, and any other vital parameters for the given scheme
	Headerer.prototype.addAuth = function(auth) {
		this.auth = auth;
	};

	// converts the headers into string forms for transfer over HTTP
	Headerer.prototype.serialize = function() {
		if (this.link && Array.isArray(this.link)) {
			// :TODO:
		}
		if (this.auth && typeof this.auth == 'object') {
			if (!this.auth.scheme) { throw "`scheme` required for auth headers"; }
			var auth;
			switch (this.auth.scheme.toLowerCase()) {
				case 'basic':
					auth = 'Basic '+/*toBase64 :TODO:*/(this.auth.name+':'+this.auth.password);
					break;
				case 'persona':
					auth = 'Persona name='+this.auth.name+' assertion='+this.auth.assertion;
					break;
				default:
					throw "unknown auth sceme: "+this.auth.scheme;
			}
			this.auth = auth;
		}
	};

	// wrap helper
	function headerer(h) {
		return (h instanceof Headerer) ? h : new Headerer(h);
	}

	exports.Headerer = Headerer;
	exports.headerer = headerer;
})(Link);