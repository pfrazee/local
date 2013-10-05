// Helpers
// =======

// EXPORTED
// takes parsed a link header and a query object, produces an array of matching links
// - `links`: [object]/object, either the parsed array of links or the request/response object
local.queryLinks = function queryLinks(links, query) {
	if (!links) return [];
	if (links.parsedHeaders) links = links.parsedHeaders.link; // actually a request or response object
	if (!Array.isArray(links)) return [];
	return links.filter(function(link) { return local.queryLink(link, query); });
};

// EXPORTED
// takes parsed link and a query object, produces boolean `isMatch`
// - `query`: object, keys are attributes to test, values are values to test against (strings)
//            eg { rel: 'foo bar', id: 'x' }
// - Query rules
//   - if a query attribute is present on the link, but does not match, returns false
//   - if a query attribute is not present on the link, and is not present in the href as a URI Template token, returns false
//   - otherwise, returns true
//   - query values preceded by an exclamation-point (!) will invert (logical NOT)
//   - rel: can take multiple values, space-separated, which are ANDed logically
//   - rel: will ignore the preceding scheme and trailing slash on URI values
//   - rel: items preceded by an exclamation-point (!) will invert (logical NOT)
local.queryLink = function queryLink(link, query) {
	for (var attr in query) {
		if (attr == 'rel') {
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
				if (RegExp('\\{[^\\}]*'+attr+'[^\\{]*\\}','i').test(link.href) === false)
					return false;
			}
			else {
				if (query[attr].indexOf('!') === 0) { // negation
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
};

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
// returns an array of preferred media types ordered by priority from a list of available media types
// - `accept`: string/object, given accept header or request object
// - `provided`: optional [string], allowed media types
local.preferredTypes = function preferredTypes(accept, provided) {
	if (typeof accept == 'object') {
		accept = accept.headers.accept;
	}
	accept = local.httpHeaders.deserialize('accept', accept || '');
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
};

// EXPORTED
// returns the top preferred media type from a list of available media types
// - `accept`: string/object, given accept header or request object
// - `provided`: optional [string], allowed media types
local.preferredType = function preferredType(accept, provided) {
	return local.preferredTypes(accept, provided)[0];
};
// </https://github.com/federomero/negotiator>

// EXPORTED
// correctly joins together all url segments given in the arguments
// eg joinUrl('/foo/', '/bar', '/baz/') -> '/foo/bar/baz/'
local.joinUrl = function joinUrl() {
	var parts = Array.prototype.map.call(arguments, function(arg, i) {
		arg = ''+arg;
		var lo = 0, hi = arg.length;
		if (arg == '/') return '';
		if (i !== 0 && arg.charAt(0) === '/') { lo += 1; }
		if (arg.charAt(hi - 1) === '/') { hi -= 1; }
		return arg.substring(lo, hi);
	});
	return parts.join('/');
};

// EXPORTED
// tests to see if a URL is absolute
// - "absolute" means that the URL can reach something without additional context
// - eg http://foo.com, //foo.com, httpl://bar.app, rel:http://foo.com, rel:foo.com
var isAbsUriRE = /^((http(s|l)?:)?\/\/)|((nav:)?\|\|)/;
local.isAbsUri = function(url) {
	if (isAbsUriRE.test(url))
		return true;
	var urld = local.parseUri(url);
	return !!local.getServer(urld.authority) || !!local.parsePeerDomain(urld.authority);
};

// EXPORTED
// tests to see if a URL is using the nav scheme
var isNavSchemeUriRE = /^(nav:)?\|?\|/i;
local.isNavSchemeUri = function(v) {
	return isNavSchemeUriRE.test(v);
};


// EXPORTED
// takes a context url and a relative path and forms a new valid url
// eg joinRelPath('http://grimwire.com/foo/bar', '../fuz/bar') -> 'http://grimwire.com/foo/fuz/bar'
local.joinRelPath = function(urld, relpath) {
	if (typeof urld == 'string') {
		urld = local.parseUri(urld);
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
	return local.joinUrl(protocol + urld.authority, hostpathParts.join('/'));
};

// EXPORTED
// parseUri 1.2.2, (c) Steven Levithan <stevenlevithan.com>, MIT License
local.parseUri = function parseUri(str) {
	if (typeof str === 'object') {
		if (str.url) { str = str.url; }
		else if (str.host || str.path) { str = local.joinUrl(req.host, req.path); }
	}

	// handle data-uris specially - performance characteristics are much different
	if (str.slice(0,5) == 'data:') {
		return { protocol: 'data', source: str };
	}

	var	o   = local.parseUri.options,
		m   = o.parser[o.strictMode ? "strict" : "loose"].exec(str),
		uri = {},
		i   = 14;

	while (i--) uri[o.key[i]] = m[i] || "";

	uri[o.q.name] = {};
	uri[o.key[12]].replace(o.q.parser, function ($0, $1, $2) {
		if ($1) uri[o.q.name][$1] = $2;
	});

	return uri;
};

local.parseUri.options = {
	strictMode: false,
	key: ["source","protocol","authority","userInfo","user","password","host","port","relative","path","directory","file","query","anchor"],
	q:   {
		name:   "queryKey",
		parser: /(?:^|&)([^&=]*)=?([^&]*)/g
	},
	parser: {
		strict: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,
		loose:  /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/
	}
};

// EXPORTED
// Converts a 'nav:' URI into an array of http/s/l URIs and link query objects
local.parseNavUri = function(str) {
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
				query.rel = kv[0].replace(/\+/, ' ');
				if (kv[1])
					query.id = kv[1];
			} else
				query[kv[0]] = decodeURIComponent(kv[1]).replace(/\+/, ' ');
		}
		parts[i] = query;
	}

	// Drop first entry if empty (a relative nav uri)
	if (!parts[0])
		parts.shift();

	return parts;
};

// EXPORTED
// breaks a peer domain into its constituent parts
// - returns { user:, relay:, provider:, app:, stream: }
//   (relay == provider -- they are synonmyms)
var peerDomainRE = /^(.+)@(.+)!(.+):([\d]+)$/i;
local.parsePeerDomain = function parsePeerDomain(domain) {
	var match = peerDomainRE.exec(domain);
	if (match) {
		return {
			user: match[1],
			relay: match[2],
			provider: match[2],
			app: match[3],
			stream: match[4]
		};
	}
	return null;
};

// EXPORTED
// constructs a peer domain from its constituent parts
// - returns string
local.makePeerDomain = function makePeerDomain(user, relay, app, stream) {
	return user+'@'+relay.replace(':','.')+'!'+app.replace(':','.')+':'+(stream||'0');
};


// sends the given response back verbatim
// - if `writeHead` has been previously called, it will not change
// - params:
//   - `target`: the response to populate
//   - `source`: the response to pull data from
//   - `headersCb`: (optional) takes `(headers)` from source and responds updated headers for target
//   - `bodyCb`: (optional) takes `(body)` from source and responds updated body for target
local.pipe = function(target, source, headersCB, bodyCb) {
	headersCB = headersCB || function(v) { return v; };
	bodyCb = bodyCb || function(v) { return v; };
	return local.promise(source)
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
};