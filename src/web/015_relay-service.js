// Local Echo Host
var relayBroadcast = local.broadcaster();
local.registerLocal('relay', function(req, res) {

	// Fake user info (local relay is just for debugging)
	var authUserId = 'local';
	var authAppDomain = window.location.host;

	if (req.path == '/') {
		res.setHeader('link', [
			{ href: '/', rel: 'self service via grimwire.com/-webprn/relay', title: 'Local Peer Relay' },
			{ href: '/streams', rel: 'collection', id: 'streams', title: 'Active Streams' },
			{ href: '/users', rel: 'collection', id: 'users', title: 'Active Users' }
		]);
		if (req.method == 'HEAD') {
			return res.writeHead(204, 'ok, no content').end();
		}
		if (req.method == 'GET') {
			if (!local.preferredType(req, 'text/event-stream')) {
				return res.writeHead(406, 'bad accept - only provides text/event-stream').end();
			}
			var streamId = relayBroadcast.addStream(res);
			res.writeHead(200, 'ok', { 'content-type': 'text/event-stream' });
			var ident = { stream: streamId, user: authUserId, app: authAppDomain };
			relayBroadcast.emitTo(res, 'ident', ident);
			relayBroadcast.emit('join', ident, { exclude: res });
			return;
		}
		return res.writeHead(405, 'bad method').end();
	}

	var pathParts = req.path.split('/');
	pathParts.shift(); // drop first entry (will always be blank)

	if (pathParts.length === 1) {
		if (pathParts[0] == 'streams') {
			res.setHeader('link', [
				{ href: '/', rel: 'up service via grimwire.com/-webprn/relay', title: 'Local Peer Relay' },
				{ href: '/streams', rel: 'self collection', id: 'streams', title: 'Active Streams' },
				{ href: '/streams/{id}', rel: 'item' }
			]);
			relayBroadcast.streams.forEach(function(stream, i) {
				res.headers.link.push({ href: '/streams/'+i, rel: 'item', id: i });
			});
			if (req.method == 'HEAD') {
				return res.writeHead(204, 'ok, no content').end();
			}
			return res.writeHead(405, 'bad method').end();
		}
		if (pathParts[0] == 'users') {
			return res.writeHead(501, 'not yet implemented').end();
		}
		return res.writeHead(404, 'not found').end();
	}

	if (pathParts.length === 2) {
		if (pathParts[0] == 'streams') {
			var stream = relayBroadcast.streams[pathParts[1]];
			if (!stream) {
				return res.writeHead(404, 'not found').end();
			}
			if (req.method == 'HEAD') {
				return res.writeHead(204, 'ok, no content').end();
			}
			if (req.method == 'POST') {
				if (req.headers['content-type'] != 'application/json') {
					return res.writeHead(415, 'bad content-type - only allows application/json').end();
				}
				req.finishStream().then(function(body) {
					if (!body.event || typeof body.event != 'string') {
						return res.writeHead(422, 'bad entity - `event` is a required string').end();
					}
					relayBroadcast.emitTo(stream, body.event, body.data);
					res.writeHead(204, 'ok no content').end();
				});
				return;
			}
			return res.writeHead(405, 'bad method').end();
		}
		if (pathParts[0] == 'users') {
			return res.writeHead(501, 'not yet implemented').end();
		}
		return res.writeHead(404, 'not found').end();
	}

	return res.writeHead(404, 'not found').end();
});