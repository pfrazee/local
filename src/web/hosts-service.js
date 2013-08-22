// Local Registry Host
local.web.registerLocal('hosts', function(req, res) {
	var localHosts = local.web.getLocalRegistry();

	if (!(req.method == 'HEAD' || req.method == 'GET'))
		return res.writeHead(405, 'bad method').end();

	if (req.method == 'GET' && !local.web.preferredType(req, 'application/json'))
		return res.writeHead(406, 'bad accept - only provides application/json').end();

	var hostResponses_ = [], i=0;
	for (var domain in localHosts) {
		if (domain == 'hosts')
			continue;
		hostResponses_.push(local.dispatch({ method: 'HEAD', url: 'httpl://'+domain }));
		hostResponses_[i++].domain = domain;
	}

	local.promise.bundle(hostResponses_)
		.then(function(hostResponses) {
			var domains = [], links = [];

			hostResponses.forEach(function(hostResponse, i) {
				var domain = hostResponses_[i].domain;
				var selfLink = local.web.queryLinks1(hostResponse, { rel: 'self' });
				if (!selfLink) {
					selfLink = {};
				}
				selfLink.href = 'httpl://'+domain;
				selfLink.id = domain;
				if (!selfLink.rel) {
					selfLink.rel = '';
				}

				// Strip standard rel values
				var relUrlRegex = /((\S*\/\/)?(\S*\.\S*))/ig, relUrlMatches, relUrls = '';
				while ((relUrlMatches = relUrlRegex.exec(selfLink.rel))) {
					relUrls += relUrlMatches[1] + ' ';
				}
				selfLink.rel = relUrls + 'service item';
				links.push(selfLink);
				domains.push(domain);
			});
			res.setHeader('link', links);

			if (req.method == 'HEAD')
				return res.writeHead(204, 'ok, no content').end();
			res.writeHead(200, 'ok', { 'content-type': 'application/json' });
			res.end({ host_names: domains });
		});


});