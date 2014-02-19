var helpers = require('./helpers.js');

// headers
// =======
// EXPORTED
// provides serializers and deserializers for HTTP headers
var httpHeaders = {
	serialize   : httpheaders__serialize,
	deserialize : httpheaders__deserialize,
	register    : httpheaders__register
};
var httpheaders__registry = {};
module.exports = httpHeaders;

// EXPORTED
// serializes an object into a string
function httpheaders__serialize(header, obj) {
	if (!obj || typeof(obj) != 'object' || !header) {
		return obj;
	}
	var fn = httpheaders__find(header, 'serializer');
	if (!fn) {
		return obj;
	}
	try {
		return fn(obj);
	} catch (e) {
		console.warn('Failed to serialize header', header, obj);
		return obj;
	}
}

// EXPORTED
// deserializes a string into an object
function httpheaders__deserialize(header, str) {
	if (!str || typeof(str) != 'string' || !header) {
		return str;
	}
	var fn = httpheaders__find(header, 'deserializer');
	if (!fn) {
		return str;
	}
	try {
		return fn(str);
	} catch (e) {
		console.warn('Failed to deserialize header', header, str);
		return str;
	}
}

// EXPORTED
// adds a header to the registry
function httpheaders__register(header, serializer, deserializer) {
	httpheaders__registry[header.toLowerCase()] = {
		serializer   : serializer,
		deserializer : deserializer
	};
}

// INTERNAL
// finds the header's de/serialization functions
function httpheaders__find(header, fn) {
	var headerFns = httpheaders__registry[header.toLowerCase()];
	if (headerFns) {
		return headerFns[fn];
	}
	return null;
}

// Default Headers
// ===============

//                                KV params
//                  "</foo>"  "; "    \/   ", <" or eol
//                   ------- -------- ---  ----------------
var linkHeaderRE1 = /<(.*?)>(?:;[\s]*(.*?)((,(?=[\s]*<))|$))/g;
//                        "key"     "="      \""val\""    "val"
//                    -------------- -       ---------   -------
var linkHeaderRE2 = /([\-a-z0-9_\.]+)=?(?:(?:"([^"]+)")|([^;\s]+))?/g;
httpHeaders.register('link',
	function (obj) {
		var links = [];
		obj.forEach(function(link) {
			var linkParts = ['<'+link.href+'>'];
			for (var attr in link) {
				if (attr == 'href') {
					continue;
				}
				if (link[attr] === null) {
					continue;
				}
				if (typeof link[attr] == 'boolean' && link[attr]) {
					linkParts.push(attr);
				} else {
					linkParts.push(attr+'="'+link[attr]+'"');
				}
			}
			links.push(linkParts.join('; '));
		});
		return links.join(', ');
	},
	function (str) {
		var links = [], linkParse1, linkParse2, link;
		// '</foo/bar>; rel="baz"; id="blah", </foo/bar>; rel="baz"; id="blah", </foo/bar>; rel="baz"; id="blah"'
		// Extract individual links
		while ((linkParse1 = linkHeaderRE1.exec(str))) { // Splits into href [1] and params [2]
			link = { href: linkParse1[1] };
			// 'rel="baz"; id="blah"'
			// Extract individual params
			while ((linkParse2 = linkHeaderRE2.exec(linkParse1[2]))) { // Splits into key [1] and value [2]/[3]
				link[linkParse2[1]] = linkParse2[2] || linkParse2[3] || true; // if no parameter value is given, just set to true
			}
			links.push(link);
		}
		return links;
	}
);

httpHeaders.register('accept',
	function (obj) {
		return obj.map(function(type) {
			var parts = [type.full];
			if (type.q !== 1) {
				parts.push('q='+type.q);
			}
			for (var k in type.params) {
				parts.push(k+'='+type.params[k]);
			}
			return parts.join('; ');
		}).join(', ');
	},
	helpers.parseAcceptHeader
);

/*
Via =  "Via" ":" 1#( received-protocol received-by [ comment ] )
received-protocol = [ protocol-name "/" ] protocol-version
protocol-name     = token
protocol-version  = token
received-by       = ( host [ ":" port ] ) | pseudonym
pseudonym         = token
*/
//                  proto-name  proto-v   received-by        comment
//                  ------      -------   --------------     ------
var viaregex = /(?:([A-z]+)\/)?([\d\.]+) ([-A-z:\d\.@!]*)(?: ([^,]+))?/g;
httpHeaders.register('via',
	function (obj) {
		return obj.map(function(via) {
			return ((via.proto.name) ? (via.proto.name+'/') : '') + via.proto.version+' '+via.hostname+((via.comment) ? (' '+via.comment) : '');
		}).join(', ');
	},
	function (str) {
		var vias = [], match;
		while ((match = viaregex.exec(str))) {
			var via = { proto: { name: (match[1]||'http'), version: match[2] }, hostname: match[3], comment: match[4] };
			vias.push(via);
		}
		return vias;
	}
);