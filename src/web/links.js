var helpers = require('./helpers');
module.exports.processLinks = function(links, baseUrl) {
	if (!links) links = [];
	links = Array.isArray(links) ? links : [links];
	links
		.filter(function(link) { return !!link; })
		.forEach(function(link) {
			// Convert relative paths to absolute uris
			if (link.href && !helpers.isAbsUri(link.href) && baseUrl) {
				if (link.href.charAt(0) == '#') {
					if (baseUrl.source) {
						// strip any hash or query param
						baseUrl = ((baseUrl.protocol) ? baseUrl.protocol + '://' : '') + baseUrl.authority + baseUrl.path;
					}
					link.href = helpers.joinUri(baseUrl, link.href);
				} else {
					link.href = helpers.joinRelPath(baseUrl, link.href);
				}
			}

			// Add `is` helper
			if (link.is && typeof link.is != 'function') link._is = link.is;
			noEnumDesc.value = helpers.queryLink.bind(null, link);
			Object.defineProperty(link, 'is', noEnumDesc);
		});

	// Add helpers
	noEnumDesc.value = helpers.queryLinks.bind(null, links);
	Object.defineProperty(links, 'query', noEnumDesc);
	noEnumDesc.value = function(query) { return this.query(query)[0]; };
	Object.defineProperty(links, 'get', noEnumDesc);

	return links;
};
var noEnumDesc = { value: null, enumerable: false, configurable: true, writable: true };