// Helpers
// =======

// EXPORTED
// breaks a link header into a javascript object
local.web.parseLinkHeader = function parseLinkHeader(headerStr) {
	if (typeof headerStr !== 'string') {
		return headerStr;
	}
	// '</foo/bar>; rel="baz"; id="blah", </foo/bar>; rel="baz"; id="blah", </foo/bar>; rel="baz"; id="blah"'
	return headerStr.split(/,[\s]*/g).map(function(linkStr) {
		// ['</foo/bar>; rel="baz"; id="blah"', '</foo/bar>; rel="baz"; id="blah"']
		var link = {};
		linkStr.split(/\s*;\s*/g).forEach(function(attrStr) {
			// ['</foo/bar>', 'rel="baz"', 'id="blah"']
			if (!attrStr) { return; }
			if (attrStr.charAt(0) === '<') {
				// '</foo/bar>'
				link.href = attrStr.trim().slice(1, -1);
			} else {
				var attrParts = attrStr.split(/\s*=\s*/g);
				if (attrParts[1]) {
					// ['rel', '"baz"'] or ['rel', 'baz']
					var k = attrParts[0];
					var v = attrParts[1].replace(/^"|"$/g, '');
					link[k] = v;
				} else {
					// ['attr']
					var k = attrParts[0];
					link[k] = true;
				}
			}
		});
		return link;
	});
};

// EXPORTED
// looks up a link in the cache and generates the URI
//  - first looks for a matching rel and id
//    eg lookupLink(links, 'item', 'foobar'), Link: <http://example.com/some/foobar>; rel="item"; id="foobar" -> http://example.com/some/foobar
//  - then looks for a matching rel with no id and uses that to generate the link
//    eg lookupLink(links, 'item', 'foobar'), Link: <http://example.com/some/{id}>; rel="item" -> http://example.com/some/foobar
local.web.lookupLink = function lookupLink(links, rel, id) {
	var len = links ? links.length : 0;
	if (!len) { return null; }

	if (id)
		id = id.toLowerCase();
	var relRegex = RegExp('\\b'+rel+'\\b');

	// try to find the link with a id equal to the param we were given
	var match = null;
	for (var i=0; i < len; i++) {
		var link = links[i];
		if (!link) { continue; }
		// find all links with a matching rel
		if (relRegex.test(link.rel)) {
			// look for a id match to the primary parameter
			if (id && link.id) {
				if (link.id.toLowerCase() === id) {
					match = link;
					break;
				}
			} else {
				// no id attribute -- it's the template URI, so hold onto it
				match = link;
			}
		}
	}

	return match ? match.href : null;
};

// EXPORTED
// takes parsed a link header and a query object, produces an array of matching links
local.web.queryLinks = function queryLinks(links, query) {
	if (!links || Array.isArray(links) === false) return [];
	return links.filter(function(link) { return local.web.queryLink(link, query); });
};

// EXPORTED
// takes parsed link and a query object, produces a boolean `isMatch`
// - `query`: object, keys are attributes to test, values are values to test against (strings)
//            eg { rel: 'foo bar', id: 'x' }
// - Query rules
//   - rel: can take multiple values, space-separated, which are ANDed logically
//   - rel: will ignore the preceding scheme and trailing slash on URI values
//   - rel: items preceded by an exclamation-point will invert (logical NOT)
local.web.queryLink = function queryLink(link, query) {
	for (var attr in query) {
		if (attr == 'rel') {
			var terms = query.rel.split(/\s+/);
			for (var i=0; i < terms.length; i++) {
				var desiredBool = true;
				if (terms[i].charAt(0) == '!') {
					terms[i] = terms[i].slice(1);
					desiredBool = false;
				}
				if (RegExp('\\b(.*//)?'+terms[i]+'\\b', 'i').test(link.rel) !== desiredBool)
					return false;
			}
		}
		else {
			if (link[attr] != query[attr])
				return false;
		}
	}
	return true;
};

// <https://github.com/federomero/negotiator>
// for to ^ for the content negotation helpers below

// EXPORTED
// breaks an accept header into a javascript object
// - `accept`: string, the accept header
local.web.parseAcceptHeader = function parseAcceptHeader(accept) {
	return accept.split(',')
		.map(function(e) { return parseMediaType(e.trim()); })
		.filter(function(e) { return e && e.q > 0; });
};

// INTERNAL
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
local.web.preferredTypes = function preferredTypes(accept, provided) {
	if (typeof accept == 'object')
		accept = accept.headers.accept;
	accept = local.web.parseAcceptHeader(accept || '');
	if (provided) {
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
local.web.preferredType = function preferredType(accept, provided) {
	return local.web.preferredTypes(accept, provided)[0];
};
// </https://github.com/federomero/negotiator>

// EXPORTED
// correctly joins together to url segments
local.web.joinUrl = function joinUrl() {
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
// parseUri 1.2.2, (c) Steven Levithan <stevenlevithan.com>, MIT License
local.web.parseUri = function parseUri(str) {
	if (typeof str === 'object') {
		if (str.url) { str = str.url; }
		else if (str.host || str.path) { str = local.web.joinUrl(req.host, req.path); }
	}

	// handle data-uris specially - performance characteristics are much different
	if (str.slice(0,5) == 'data:') {
		return { protocol: 'data', source: str };
	}

	var	o   = local.web.parseUri.options,
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

local.web.parseUri.options = {
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

// sends the given response back verbatim
// - if `writeHead` has been previously called, it will not change
// - params:
//   - `target`: the response to populate
//   - `source`: the response to pull data from
//   - `headersCb`: (optional) takes `(headers)` from source and responds updated headers for target
//   - `bodyCb`: (optional) takes `(body)` from source and responds updated body for target
local.web.pipe = function(target, source, headersCB, bodyCb) {
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