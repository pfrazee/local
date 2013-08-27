// Local Registry Host
local.web.registerLocal('hosts', function(req, res) {
	var localHosts = local.web.getLocalRegistry();

	if (!(req.method == 'HEAD' || req.method == 'GET'))
		return res.writeHead(405, 'bad method').end();

	if (req.method == 'GET' && !local.web.preferredType(req, 'application/json'))
		return res.writeHead(406, 'bad accept - only provides application/json').end();

	var domains = [], links = [];
	links.push({ href: '/', rel: 'self service via', id: 'hosts' });
	for (var domain in localHosts) {
		if (domain == 'hosts')
			continue;
		domains.push(domain);
		links.push({ href: 'httpl://'+domain, id: domain, rel: 'service' });
	}
	res.setHeader('link', links);

	if (req.method == 'HEAD')
		return res.writeHead(204, 'ok, no content').end();
	res.writeHead(200, 'ok', { 'content-type': 'application/json' });
	res.end({ host_names: domains });
});