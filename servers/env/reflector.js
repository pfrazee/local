(function(exports) {
	// ReflectorServer
	// ===============
	// HTTP access to the source of active workers
	var _root_   = '/';
	var _domain_ = /^\/([A-z0-9_\-\.]+)\/?$/i; // /:domain
	var _editor_ = /^\/([A-z0-9_\-\.]+)\/editor\/?$/i; // /:domain/editor
	function ReflectorServer() {
		local.env.Server.call(this);
	}
	exports.ReflectorServer = ReflectorServer;
	ReflectorServer.prototype = Object.create(local.env.Server.prototype);

	// request router
	ReflectorServer.prototype.handleHttpRequest = function(request, response) {
		// :DEBUG: temporary helper fn
		var handled = false, self = this;
		function route(method, path, fn) {
			if (handled) return;
			if (method && path) {
				if (RegExp('^'+path+'$','i').test(request.path) && RegExp('^'+method+'$','i').test(request.method)) {
					handled = true;
					request.body_.always(function() {
						fn.call(self, request, response);
					});
				}
			} else
				response.writeHead(404,'not found').end();
		}

		route('HEAD|GET', '/', httpListServers);
		route('HEAD|GET', '/([A-z0-9_\\-\\.]+)/?', httpGetServer);
		route('PUT',      '/([A-z0-9_\\-\\.]+)/?', httpPutServer);
		route('HEAD|GET', '/([A-z0-9_\\-\\.]+)/editor/?', httpGetServerEditor);
		route('POST',     '/([A-z0-9_\\-\\.]+)/editor/?', httpPostServerEditor);
		route();
	};

	// GET|HEAD /
	function httpListServers(request, response) {
		if (!/json/.test(request.headers.accept))
			return response.writeHead(406, 'not acceptable').end();

		// build headers
		var configs = [];
		var headers = {
			link: [{ href:'/', rel:'self current collection' }]
		};
		var servers = local.env.servers;
		for (var domain in servers) {
			headers.link.push({ href:'/'+domain, rel:'item', id:domain });
			configs.push(servers[domain].config);
		}

		if (/GET/i.test(request.method)) {
			headers['content-type'] = 'application/json';
			response.writeHead(200, 'ok', headers).end(configs);
		} else
			response.writeHead(200, 'ok', headers).end();
	}

	// GET|HEAD /:domain
	function httpGetServer(request, response) {
		var match = RegExp('^/([^\/]+)/').exec(request.path);
		var domain = match[1];
		var headers = {
			link:[{ href:'/', rel:'up via service collection' }]
		};

		var server = local.env.getServer(domain);
		if (server) {
			headers.links.push({ href:'/'+domain, rel:'self current' });
			if (/GET/i.test(request.method)) {
				if (/json/.test(request.headers.accept)) {
					headers['content-type'] = 'application/json';
					response.writeHead(200, 'ok'. headers).end(server.config);
				}
				else if (/javascript/.test(request.headers.accept)) {
					// retrieve source
					Local.promise(server.getSource())
						.then(function(source) {
					headers['content-type'] = 'application/javascript';
							response.writeHead(200, 'ok', headers).end(source);
						}, function(err) { respond.badGateway(headerer).end(); });
				} else
					response.writeHead(406, 'not acceptable').end();
			} else
				response.writeHead(200, 'ok', headers).end();
		} else
			response.writeHead(404, 'not found').end();
	}

	// PUT /:domain
	function httpPutServer(request, response) {
		var match = RegExp('^/([^\/]+)/').exec(request.path);
		var domain = match[1];
		var headers = {
			link:[{ href:'/', rel:'up via service collection' }]
		};

		var server = local.env.getServer(domain);
		if (server) {
			headers.links.push({ href:'/'+domain, rel:'self current' });
			if (/javascript/i.test(request.headers['content-type'])) {
				if (server instanceof local.env.WorkerServer) {
					var config = server.config;
					// shutdown the server
					local.env.killServer(domain);
					// load a new server in-place with the given source
					config.script = request.body;
					local.env.addServer(domain, new local.env.WorkerServer(config));
					// done
					response.writeHead(200, 'ok', headers).end();
				} else {
					// can't live-update environment servers (...yet?)
					response.writeHead(200, 'only worker servers can be live-updated').end();
				}
			} else
				return response.writeHead(406, 'not acceptable').end();
		} else
			response.writeHead(404, 'not found').end();
	}

	// GET /:domain/editor
	function httpGetServerEditor(request, response) {
		var self = this;
		var match = RegExp('^/([^\/]+)/').exec(request.path);
		var domain = match[1];
		var headers = {
			link:[{ href:'/', rel:'via service collection' }]
		};

		var server = local.env.getServer(domain);
		if (server) {
			headers.link.push({ href:'/'+domain, rel:'up item' });
			headers.link.push({ href:'/'+domain+'/editor', rel:'self current' });
			if (/GET/i.test(request.method)) {
				// retrieve source
				local.promise(server.getSource())
					.then(function(source) {
						headers['content-type'] = 'text/html';
						response.writeHead(200, 'ok', headers).end(renderServerEditorHtml(self.config.domain, domain, source));
					}, function(err) { response.writeHead(502, 'bad gateway').end(); });
			} else
				response.writeHead(200, 'ok', headers).end();
		} else
			response.writeHead(404, 'not found').end();
	}

	function renderServerEditorHtml(reflectorDomain, workerDomain, source) {
		source = source.replace(/</g,'&lt;').replace(/>/g,'&gt;');
		return [
			'<p>Editing ',workerDomain,'</p>',
			'<form action="httpl://',reflectorDomain,'/',workerDomain,'/editor" method="post">',
				'<textarea name="source" class="input-block-level" rows="20">',source,'</textarea>',
				'<a class="btn" href="httpl://',workerDomain,'">Cancel</a> ',
				'<button type="submit" class="btn btn-primary">Reload</button>',
			'</form>'
		].join('');
	}

	// POST /:domain/editor
	function httpPostServerEditor(request, response) {
		var match = RegExp('^/([^\/]+)/').exec(request.path);
		var domain = match[1];
		var headers = {
			link:[{ href:'/', rel:'via service collection' }]
		};

		var server = local.env.getServer(domain);
		if (server) {
			headers.link.push({ href:'/'+domain, rel:'up item' });
			headers.link.push({ href:'/'+domain+'/editor', rel:'self current' });

			if (server instanceof local.env.WorkerServer) {
				var config = server.config;
				// shutdown the server
				local.env.killServer(domain);
				// load a new server in-place with the given source
				config.src = 'data:application/javascript;base64,'+btoa(request.body.source);
				local.env.addServer(domain, new local.env.WorkerServer(config));
				// respond by piping a request to the new server
				local.web.pipe(
					response,
					local.web.dispatch({ method:'get', url:'httpl://'+domain, headers:{ accept:'text/html' }}, this)
				);
			} else {
				// can't live-update environment servers (...yet?)
				response.writeHead(200, 'only worker servers can be live-updated').end();
			}
		} else
			response.writeHead(404, 'not found').end();
	}
})(window);