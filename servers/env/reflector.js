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
		var router = local.http.ext.router(request);
		router.pm (_root_,   /HEAD|GET/i, httpListServers.bind(this, request, response));
		router.pm (_domain_, /HEAD|GET/i, httpGetServer.bind(this, request, response));
		router.pm (_domain_, /PUT/i,      httpPutServer.bind(this, request, response));
		router.pma(_editor_, /HEAD|GET/i, /html/i, httpGetServerEditor.bind(this, request, response));
		router.pmt(_editor_, /POST/i,     /urlencoded/i, httpPostServerEditor.bind(this, request, response));
		router.error(response);
	};

	// GET|HEAD /
	function httpListServers(request, response) {
		var respond = local.http.ext.responder(response);
		// build headers
		var headerer = local.http.ext.headerer();
		headerer.addLink('/', 'self current collection');
		var servers = local.env.servers;
		var configs = [];
		for (var domain in servers) {
			headerer.addLink('/'+domain, 'item', { title:domain });
			configs.push(servers[domain].config);
		}

		if (/GET/i.test(request.method)) {
			// respond with data
			respond.ok('json', headerer).end(configs);
		} else {
			// respond with headers
			respond.ok(null, headerer).end();
		}
	}

	// GET|HEAD /:domain
	function httpGetServer(request, response, match) {
		var domain = match.path[1];
		var respond = local.http.ext.responder(response);
		var router = local.http.ext.router(request);
		// headers
		var headerer = local.http.ext.headerer();
		headerer.addLink('/', 'up via service collection');
		// find
		var server = local.env.getServer(domain);
		if (server) {
			// add links
			headerer.addLink('/'+domain, 'self current');
			if (/GET/i.test(request.method)) {
				// respond with data
				router.a(/json/i, function() {
					respond.ok('json', headerer).end(server.config);
				});
				router.a(/javascript/i, function() {
					// retrieve source
					Local.promise(server.getSource())
						.then(function(source) {
							respond.ok('application/javascript', headerer).end(source);
						}, function(err) { respond.badGateway(headerer).end(); });
				});
				router.error(response);
			} else {
				// respond with headers
				respond.ok(null, headerer).end();
			}
		} else {
			respond.notFound().end();
		}
	}

	// PUT /:domain
	function httpPutServer(request, response, match) {
		var domain = match.path[1];
		var respond = local.http.ext.responder(response);
		var router = local.http.ext.router(request);
		// headers
		var headerer = local.http.ext.headerer();
		headerer.addLink('/', 'up via service collection');
		// find
		var server = local.env.getServer(domain);
		if (server) {
			// add links
			headerer.addLink('/'+domain, 'self current');
			router.t(/javascript/i, function() {
				if (server instanceof local.env.WorkerServer) {
					// shutdown the server
					local.env.killServer(domain);
					// load a new server in-place with the given source
					local.env.addServer(domain, new local.env.WorkerServer({ script:request.body }));
					// done
					respond.ok().end();
				} else {
					// can't live-update environment servers (...yet?)
					respond.respond([400, 'only worker servers can be live-updated']).end();
				}
			});
			router.error(response);
		} else {
			respond.notFound().end();
		}
	}

	// GET /:domain/editor
	function httpGetServerEditor(request, response, match) {
		var self = this;
		var respond = local.http.ext.responder(response);
		var domain = match.path[1];
		// headers
		var headerer = local.http.ext.headerer();
		headerer.addLink('/', 'via service collection');
		// find
		var server = local.env.getServer(domain);
		if (server) {
			// add links
			headerer.addLink('/'+domain, 'up item');
			headerer.addLink('/'+domain+'/editor', 'self current');
			if (/GET/i.test(request.method)) {
				// retrieve source
				local.promise(server.getSource())
					.then(function(source) {
						respond.ok('html').end(renderServerEditorHtml(self.config.domain, domain, source));
					}, function(err) { respond.badGateway(headerer).end(); });
			} else {
				// respond with headers
				respond.ok(null, headerer).end();
			}
		} else {
			respond.notFound().end();
		}
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
	function httpPostServerEditor(request, response, match) {
		var respond = local.http.ext.responder(response);
		var domain = match.path[1];
		var self = this;
		// headers
		var headerer = local.http.ext.headerer();
		headerer.addLink('/', 'via service collection');
		// find
		var server = local.env.getServer(domain);
		if (server) {
			// add links
			headerer.addLink('/'+domain, 'up item');
			headerer.addLink('/'+domain+'/editor', 'self current');

			if (server instanceof local.env.WorkerServer) {
				// shutdown the server
				local.env.killServer(domain);
				// load a new server in-place with the given source
				local.env.addServer(domain, new local.env.WorkerServer({ script:request.body.source }));
				// respond by piping a request to the new server
				respond.pipe(local.http.dispatch({ method:'get', url:'httpl://'+domain, headers:{ accept:'text/html' }}, this));
			} else {
				// can't live-update environment servers (...yet?)
				respond.respond([400, 'only worker servers can be live-updated']).end();
			}
		} else {
			respond.notFound().end();
		}
	}
})(window);