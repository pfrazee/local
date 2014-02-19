// Helpers
// =======

var httpHeaders = require('./http-headers.js');
var promise = require('../promises.js').promise;
var UriTemplate = require('./uri-template.js');

// EXPORTED
// takes parsed a link header and a query object, produces an array of matching links
// - `links`: [object]/object, either the parsed array of links or the request/response object
// - `query`: object
function queryLinks(links, query) {
	if (!links) return [];
	if (links.parsedHeaders) links = links.parsedHeaders.link; // actually a request or response object
	if (!Array.isArray(links)) return [];
	return links.filter(function(link) { return queryLink(link, query); });
}

// EXPORTED
// takes parsed link and a query object, produces boolean `isMatch`
// - `query`: object, keys are attributes to test, values are values to test against (strings)
//            eg { rel: 'foo bar', id: 'x' }
// - Query rules
//   - if a query attribute is present on the link, but does not match, returns false
//   - if a query attribute is not present on the link, and is not present in the href as a URI Template token, returns false
//   - otherwise, returns true
//   - query values preceded by an exclamation-point (!) will invert (logical NOT)
//   - query values may be a function which receive (value, key) and return true if matching
//   - rel: can take multiple values, space-separated, which are ANDed logically
//   - rel: will ignore the preceding scheme and trailing slash on URI values
//   - rel: items preceded by an exclamation-point (!) will invert (logical NOT)
var uriTokenStart = '\\{([^\\}]*)[\\+\\#\\.\\/\\;\\?\\&]?';
var uriTokenEnd = '(\\,|\\})';
function queryLink(link, query) {
	for (var attr in query) {
		if (typeof query[attr] == 'function') {
			if (!query[attr].call(null, link[attr], attr)) {
				return false;
			}
		} else if (attr == 'rel') {
			var terms = query.rel.split(/\s+/);
			for (var i=0; i < terms.length; i++) {
				var desiredBool = true;
				if (terms[i].charAt(0) == '!') {
					terms[i] = terms[i].slice(1);
					desiredBool = false;
				}
				if (RegExp('(\\s|^)(.*//)?'+terms[i]+'(\\s|$)', 'i').test(link.rel) !== desiredBool)
					return false;
			}
		}
		else {
			if (typeof link[attr] == 'undefined') {
				// Attribute not explicitly set -- is it present in the href as a URI token?
				if (RegExp(uriTokenStart+attr+uriTokenEnd,'i').test(link.href) === true)
					continue;
				// Is the test value not falsey?
				if (!!query[attr])
					return false; // specific value needed
			}
			else {
				if (query[attr] && query[attr].indexOf && query[attr].indexOf('!') === 0) { // negation
					if (link[attr] == query[attr].slice(1))
						return false;
				} else {
					if (link[attr] != query[attr])
						return false;
				}
			}
		}
	}
	return true;
}

// <https://github.com/federomero/negotiator>
// thanks to ^ for the content negotation helpers below
// INTERNAL
function getMediaTypePriority(type, accepted) {
	var matches = accepted
		.filter(function(a) { return specify(type, a); })
		.sort(function (a, b) { return a.q > b.q ? -1 : 1; }); // revsort
	return matches[0] ? matches[0].q : 0;
}
// INTERNAL
function specifies(spec, type) {
	return spec === '*' || spec === type;
}
// INTERNAL
function specify(type, spec) {
	var p = parseMediaType(type);

	if (spec.params) {
		var keys = Object.keys(spec.params);
		if (keys.some(function (k) { return !specifies(spec.params[k], p.params[k]); })) {
			// some didn't specify.
			return null;
		}
	}

	if (specifies(spec.type, p.type) && specifies(spec.subtype, p.subtype)) {
		return spec;
	}
}

// EXPORTED
// thanks to https://github.com/federomero/negotiator
function parseMediaType(s) {
	var match = s.match(/\s*(\S+)\/([^;\s]+)\s*(?:;(.*))?/);
	if (!match) return null;

	var type = match[1];
	var subtype = match[2];
	var full = "" + type + "/" + subtype;
	var params = {}, q = 1;

	if (match[3]) {
		params = match[3].split(';')
			.map(function(s) { return s.trim().split('='); })
			.reduce(function (set, p) { set[p[0]] = p[1]; return set; }, params);

		if (params.q !== null) {
			q = parseFloat(params.q);
			delete params.q;
		}
	}

	return {
		type: type,
		subtype: subtype,
		params: params,
		q: q,
		full: full
	};
}

function parseAcceptHeader(str) {
	return str.split(',')
		.map(function(e) { return parseMediaType(e.trim()); })
		.filter(function(e) { return e && e.q > 0; });
}

// EXPORTED
// returns an array of preferred media types ordered by priority from a list of available media types
// - `accept`: string/object, given accept header or request object
// - `provided`: optional [string], allowed media types
function preferredTypes(accept, provided) {
	if (typeof accept == 'object') {
		accept = accept.headers.accept;
	}
	accept = parseAcceptHeader(accept || '');
	if (provided) {
		if (!Array.isArray(provided)) {
			provided = [provided];
		}
		return provided
			.map(function(type) { return [type, getMediaTypePriority(type, accept)]; })
			.filter(function(pair) { return pair[1] > 0; })
			.sort(function(a, b) { return a[1] === b[1] ? 0 : a[1] > b[1] ? -1 : 1; }) // revsort
			.map(function(pair) { return pair[0]; });
	}
	return accept.map(function(type) { return type.full; });
}

// EXPORTED
// returns the top preferred media type from a list of available media types
// - `accept`: string/object, given accept header or request object
// - `provided`: optional [string], allowed media types
function preferredType(accept, provided) {
	return preferredTypes(accept, provided)[0];
}
// </https://github.com/federomero/negotiator>

// EXPORTED
// correctly joins together all url segments given in the arguments
// eg joinUri('/foo/', '/bar', '/baz/') -> '/foo/bar/baz/'
function joinUri() {
	var parts = Array.prototype.map.call(arguments, function(arg, i) {
		arg = ''+arg;
		var lo = 0, hi = arg.length;
		if (arg == '/') return '';
		if (i !== 0 && arg.charAt(0) === '/') { lo += 1; }
		if (arg.charAt(hi - 1) === '/') { hi -= 1; }
		return arg.substring(lo, hi);
	});
	return parts.join('/');
}

// EXPORTED
// tests to see if a URL is absolute
// - "absolute" means that the URL can reach something without additional context
// - eg http://foo.com, //foo.com, httpl://bar.app
var hasSchemeRegex = /^((http(s|l)?:)?\/\/)|((nav:)?\|\|)|(data:)/;
function isAbsUri(url) {
	// Has a scheme?
	if (hasSchemeRegex.test(url))
		return true;
	// No scheme, is it a local server or a global URI?
	var urld = parseUri(url);
	return !!require('./httpl.js').getServer(urld.authority) || !!parsePeerDomain(urld.authority);
}

// EXPORTED
// tests to see if a URL is using the nav scheme
var isNavSchemeUriRE = /^(nav:)?\|?\|/i;
function isNavSchemeUri(v) {
	return isNavSchemeUriRE.test(v);
}


// EXPORTED
// takes a context url and a relative path and forms a new valid url
// eg joinRelPath('http://grimwire.com/foo/bar', '../fuz/bar') -> 'http://grimwire.com/foo/fuz/bar'
function joinRelPath(urld, relpath) {
	if (typeof urld == 'string') {
		urld = parseUri(urld);
	}
	var protocol = (urld.protocol) ? urld.protocol + '://' : false;
	if (!protocol) {
		if (urld.source.indexOf('//') === 0) {
			protocol = '//';
		} else if (urld.source.indexOf('||') === 0) {
			protocol = '||';
		} else {
			protocol = 'httpl://';
		}
	}
	if (relpath.charAt(0) == '/') {
		// "absolute" relative, easy stuff
		return protocol + urld.authority + relpath;
	}
	// totally relative, oh god
	// (thanks to geoff parker for this)
	var hostpath = urld.path;
	var hostpathParts = hostpath.split('/');
	var relpathParts = relpath.split('/');
	for (var i=0, ii=relpathParts.length; i < ii; i++) {
		if (relpathParts[i] == '.')
			continue; // noop
		if (relpathParts[i] == '..')
			hostpathParts.pop();
		else
			hostpathParts.push(relpathParts[i]);
	}
	return joinUri(protocol + urld.authority, hostpathParts.join('/'));
}

// EXPORTED
// parseUri 1.2.2, (c) Steven Levithan <stevenlevithan.com>, MIT License
function parseUri(str) {
	if (typeof str === 'object') {
		if (str.url) { str = str.url; }
		else if ((str.headers && str.headers.host) || str.path) { str = joinUri(str.headers.host, str.path); }
	}

	// handle data-uris specially
	if (str.slice(0,5) == 'data:') {
		return { protocol: 'data', source: str };
	}

	// handle peer-uris specially
	if (str.indexOf('!') !== -1) {
		var schemeSepI = str.indexOf('//');
		var firstSlashI = str.indexOf('/', schemeSepI+2);
		var peerdomain = str.slice((schemeSepI !== -1) ? schemeSepI+2 : 0, (firstSlashI !== -1) ? firstSlashI : str.length);
		var peerd = parsePeerDomain(peerdomain);
		if (peerd) {
			var urld = {};
			if (firstSlashI !== -1 && str.slice(firstSlashI)) {
				urld = parseUri(str.slice(firstSlashI));
			}
			urld.protocol = 'httpl';
			urld.host = urld.authority = peerdomain;
			urld.port = urld.password = urld.user = urld.userInfo = '';
			urld.source = str;
			return urld;
		}
	}

	var	o   = parseUri.options,
		m   = o.parser[o.strictMode ? "strict" : "loose"].exec(str),
		uri = {},
		i   = 15;

	while (i--) uri[o.key[i]] = m[i] || "";

	uri[o.q.name] = {};
	uri[o.key[13]].replace(o.q.parser, function ($0, $1, $2) {
		if ($1) uri[o.q.name][$1] = $2;
	});

	return uri;
}

parseUri.options = {
	strictMode: false,
	key: ["source","protocol","authority","userInfo","user","password","host","port","srcPath","relative","path","directory","file","query","anchor"],
	q:   {
		name:   "queryKey",
		parser: /(?:^|&)([^&=]*)=?([^&]*)/g
	},
	parser: {
		strict: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@\/]*)(?::([^:@\/]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,
		loose:  /^(?:(?![^:@\/]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@\/]*)(?::([^:@\/]*))?)?@)?([^:\/\[?#]*)(?::(\d*))?(?:\[([^\]]+)\])?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/
	//             -------------------------------------   ------   ----------------------------------------------------------------------------  ===================================relative=============================================
	//                --------------------  ==scheme==               --------------------------------   ====host===  --------   --------------     ======================path===================================  -----------   -------
	//                                                                  ========userInfo========                         ===         ======         ===================directory====================   ==file==        =====        ==
	//                                                                   ==user==   -----------                      port^    srcPath^                 ----------------------------------------                   query^      anchor^
	//                                                                                 ==pass=                                                                 -------------------------------
	//                                                                                                                                                                                -------
	}
};

// EXPORTED
// Converts a 'nav:' URI into an array of http/s/l URIs and link query objects
function parseNavUri(str) {
	if (!str) return [];

	// Check (and strip out) scheme
	var schemeIndex = str.indexOf('||');
	if (schemeIndex !== -1) {
		str = str.slice(schemeIndex+2);
	}

	// Split into navigations
	var parts = str.split('|');

	// Parse queries
	// eg ...|rel=id,attr1=value1,attr2=value2|...
	for (var i=1; i < parts.length; i++) {
		var query = {};
		var attrs = parts[i].split(',');
		for (var j=0; j < attrs.length; j++) {
			var kv = attrs[j].split('=');
			if (j === 0) {
				query.rel = kv[0].replace(/\+/g, ' ');
				if (kv[1])
					query.id = kv[1];
			} else
				query[kv[0]] = decodeURIComponent(kv[1]).replace(/\+/g, ' ');
		}
		parts[i] = query;
	}

	// Limit to 5 navigations (and 1 base)
	if (parts.length > 6)
		parts.length = 6;

	// Drop first entry if empty (a relative nav uri)
	if (!parts[0])
		parts.shift();

	return parts;
}

// EXPORTED
// breaks a peer domain into its constituent parts
// - returns { user:, relay:, app:, sid: }
var peerDomainRE = /^(.+)@([^!]+)!([^!\/]+)(?:!([\d]+))?$/i;
function parsePeerDomain(domain) {
	var match = peerDomainRE.exec(domain);
	if (match) {
		return {
			domain: domain,
			user: match[1],
			relay: match[2],
			provider: match[2], // :TODO: remove
			app: match[3],
			stream: match[4] || 0, // :TODO: remove
			sid: match[4] || 0
		};
	}
	return null;
}

// EXPORTED
// constructs a peer domain from its constituent parts
// - returns string
function makePeerDomain(user, relay, app, sid) {
	return user+'@'+relay+'!'+app+((sid) ? '!'+sid : '');
}

// EXPORTED
// builds a proxy URI out of an array of templates
// eg ('httpl://my_worker.js/', ['httpl://0.page/{uri}', 'httpl://foo/{?uri}'])
// -> "httpl://0.page/httpl%3A%2F%2Ffoo%2F%3Furi%3Dhttpl%253A%252F%252Fmy_worker.js%252F"
function makeProxyUri(uri, templates) {
	if (!Array.isArray(templates)) templates = [templates];
	for (var i=templates.length-1; i >= 0; i--) {
		var tmpl = templates[i];
		uri = UriTemplate.parse(tmpl).expand({ uri: uri });
	}
	return uri;
}

// EXPORTED
// sends the given response back verbatim
// - if `writeHead` has been previously called, it will not change
// - params:
//   - `target`: the response to populate
//   - `source`: the response to pull data from
//   - `headersCb`: (optional) takes `(headers)` from source and responds updated headers for target
//   - `bodyCb`: (optional) takes `(body)` from source and responds updated body for target
function pipe(target, source, headersCB, bodyCb) {
	headersCB = headersCB || function(v) { return v; };
	bodyCb = bodyCb || function(v) { return v; };
	return promise(source)
		.succeed(function(source) {
			if (!target.status) {
				// copy the header if we don't have one yet
				target.writeHead(source.status, source.reason, headersCB(source.headers));
			}
			if (source.body !== null && typeof source.body != 'undefined') { // already have the body?
				target.write(bodyCb(source.body));
			}
			if (source.on && source.isConnOpen) {
				// wire up the stream
				source.on('data', function(data) {
					target.write(bodyCb(data));
				});
				source.on('end', function() {
					target.end();
				});
			} else {
				target.end();
			}
			return target;
		})
		.fail(function(source) {
			var ctype = source.headers['content-type'] || 'text/plain';
			var body = (ctype && source.body) ? source.body : '';
			target.writeHead(502, 'bad gateway', {'content-type':ctype});
			target.end(body);
			throw source;
		});
}

// EXPORTED
// modifies XMLHttpRequest to support HTTPL
function patchXHR() {
	// Store references to original methods
	var orgXHR = XMLHttpRequest;
	var orgPrototype = XMLHttpRequest.prototype;
	function localXMLHttpRequest() {}
	(window || self).XMLHttpRequest = localXMLHttpRequest;
	localXMLHttpRequest.UNSENT = 0;
	localXMLHttpRequest.OPENED = 1;
	localXMLHttpRequest.HEADERS_RECEIVED = 2;
	localXMLHttpRequest.LOADING = 4;
	localXMLHttpRequest.DONE = 4;

	localXMLHttpRequest.prototype.open = function(method, url, async, user, password) {
		// Is HTTPL?
		var urld = parseUri(url);
		if (urld.protocol != 'httpl') {
			Object.defineProperty(this, '__xhr_request', { value: new orgXHR() });
			return this.__xhr_request.open(method, url, async, user, password);
		}

		// Construct request
		var Request = require('./request.js');;
		Object.defineProperty(this, '__local_request', { value: new Request({ method: method, url: url, stream: true }) });
		if (user) {
			this.__local_request.setHeader('Authorization', 'Basic '+btoa(user+':'+password));
		}

		// Update state
		this.readyState = 1;
		if (this.onreadystatechange) {
			this.onreadystatechange();
		}
	};

	localXMLHttpRequest.prototype.send = function(data) {
		var this2 = this;
		if (this.__local_request) {
			// Dispatch and send data
			var res_ = require('./dispatch.js').dispatch(this.__local_request);
			this.__local_request.end(data);

			// Wire up events
			res_.always(function(res) {
				Object.defineProperty(this2, '__local_response', { value: res });
				// Update state
				this2.readyState = 2;
				this2.status = res.status;
				this2.statusText = res.status + ' ' + res.reason;
				this2.responseText = null;
				// Fire event
				if (this2.onreadystatechange) {
					this2.onreadystatechange();
				}
				res.on('data', function(chunk) {
					this2.readyState = 3;
					if (this2.responseText === null && typeof chunk == 'string') this2.responseText = '';
					this2.responseText += chunk;
					// Fire event
					if (this2.onreadystatechange) {
						this2.onreadystatechange();
					}
				});
				res.on('end', function() {
					this2.readyState = 4;
					switch (this2.responseType) {
						case 'json':
							this2.response = res.body;
							break;

						case 'text':
						default:
							this2.response = this2.responseText;
							break;
					}
					// Fire event
					if (this2.onreadystatechange) {
						this2.onreadystatechange();
					}
					if (this2.onload) {
						this2.onload();
					}
				});
			});
		} else {
			// Copy over any attributes we've been given
			this.__xhr_request.onreadystatechange = function() {
				for (var k in this) {
					if (typeof this[k] == 'function') continue;
					this2[k] = this[k];
				}
				if (this2.onreadystatechange) {
					this2.onreadystatechange();
				}
			};
			return this.__xhr_request.send(data);
		}
	};

	localXMLHttpRequest.prototype.abort = function() {
		if (this.__local_request) {
			return this.__local_request.close();
		} else {
			return this.__xhr_request.abort();
		}
	};

	localXMLHttpRequest.prototype.setRequestHeader = function(k, v) {
		if (this.__local_request) {
			return this.__local_request.setHeader(k.toLowerCase(), v);
		} else {
			return this.__xhr_request.setRequestHeader(k, v);
		}
	};

	localXMLHttpRequest.prototype.getAllResponseHeaders = function(k) {
		if (this.__local_request) {
			return this.__local_response ? this.__local_response.headers : null;
		} else {
			return this.__xhr_request.getAllResponseHeaders(k);
		}
	};

	localXMLHttpRequest.prototype.getResponseHeader = function(k) {
		if (this.__local_request) {
			return this.__local_response ? this.__local_response.getHeader(k) : null;
		} else {
			return this.__xhr_request.getResponseHeader(k);
		}
	};
}

module.exports = {
	queryLinks: queryLinks,
	queryLink: queryLink,

	preferredTypes: preferredTypes,
	preferredType: preferredType,
	parseMediaType: parseMediaType,
	parseAcceptHeader: parseAcceptHeader,

	joinUri: joinUri,
	joinRelPath: joinRelPath,

	isAbsUri: isAbsUri,
	isNavSchemeUri: isNavSchemeUri,

	parseUri: parseUri,
	parseNavUri: parseNavUri,
	parsePeerDomain: parsePeerDomain,
	makePeerDomain: makePeerDomain,
	makeProxyUri: makeProxyUri,

	pipe: pipe,

	patchXHR: patchXHR
};