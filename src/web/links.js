var promise = require('../promises').promise;
var helpers = require('./helpers');
var server = require('./server');

var linksFetches = [];
server.createServer(function(req, res) {
	promise.bundle(linksFetches).always(function(linkss) {
		// Flatten arrays
		var links = [];
		links = links.concat.apply(links, linkss);
		// Respond with links
		res.s204('Ok, no content').link(links).end();
	});
}).listen({ local: 'links.local.js' });

module.exports.addLinks = function(source) {
	if (typeof Document != 'undefined' && (source instanceof Document)) {
		linksFetches.push(helpers.extractDocumentLinks(source, { links: true }));
	} else if (typeof source == 'string') {
		linksFetches.push(web.head(source).always(function(res) {
			return res.links;
		}));
	}
};

module.exports.clearLinks = function() {
	linksFetches.length = 0;
};

module.exports.processLinks = function(links, baseUrl) {
	if (!links) links = [];
	links = Array.isArray(links) ? links : [links];
	links
		.filter(function(link) { return !!link; })
		.forEach(function(link) {
			// Convert relative paths to absolute uris
			if (link.href && !helpers.isAbsUri(link.href) && baseUrl) {
				link.href = helpers.joinRelPath(baseUrl, link.href);
			}

			// Add `is` helper
			if (link.is && typeof link.is != 'function') link._is = link.is;
			if (!link.is) {
				noEnumDesc.value = helpers.queryLink.bind(null, link);
				Object.defineProperty(link, 'is', noEnumDesc);
			}
		});

	// Add helpers
	if (!links.query) {
		noEnumDesc.value = helpers.queryLinks.bind(null, links);
		Object.defineProperty(links, 'query', noEnumDesc);
	}
	if (!links.get) {
		noEnumDesc.value = function(query) { return this.query(query)[0]; };
		Object.defineProperty(links, 'get', noEnumDesc);
	}

	return links;
};
var noEnumDesc = { value: null, enumerable: false, configurable: true, writable: true };