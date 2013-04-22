// Headerer
// ========
// EXPORTED
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
local.http.ext.Headerer = Headerer;

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
	return this;
};

// sets the Authorization header
// - `auth` must include a `scheme`, and any other vital parameters for the given scheme
Headerer.prototype.setAuth = function(auth) {
	this.authorization = auth;
	return this;
};

// converts the headers into string forms for transfer over HTTP
Headerer.prototype.serialize = function() {
	if (this.link && Array.isArray(this.link)) {
		// :TODO:
		throw "Link header serialization is not yet implemented";
	}
	if (this.authorization && typeof this.authorization == 'object') {
		if (!this.authorization.scheme) { throw "`scheme` required for auth headers"; }
		var auth;
		switch (this.authorization.scheme.toLowerCase()) {
			case 'basic':
				auth = 'Basic '+btoa(this.authorization.name+':'+this.authorization.password);
				break;
			case 'persona':
				auth = 'Persona name='+this.authorization.name+' assertion='+this.authorization.assertion;
				break;
			default:
				throw "unknown auth sceme: "+this.authorization.scheme;
		}
		this.authorization = auth;
	}
	return this;
};

// builder fn
local.http.ext.headerer = function(h) {
	return (h instanceof Headerer) ? h : new Headerer(h);
};