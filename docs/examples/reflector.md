env/reflector.js
================

pfraze 2013


## Overview
The reflector server shows how in-document servers can be used to control the environment. It is likely that application management will be needed in some environments; this server is a good starting-point.


## reflector.js

```javascript
// ReflectorServer
// ===============
// provides tools for services to self-manage
var _root_   = '/';
var _domain_ = /^\/([A-z0-9_\-\.]+)\/?$/i; // /:domain
var _editor_ = /^\/([A-z0-9_\-\.]+)\/editor\/?$/i; // /:domain/editor
function ReflectorServer() {
	Environment.Server.call(this);
	this.state = Environment.Server.ACTIVE;
}
ReflectorServer.prototype = Object.create(Environment.Server.prototype);

// request router
ReflectorServer.prototype.handleHttpRequest = function(request, response) {
	var router = Link.router(request);
	router.pm (_root_,   /HEAD|GET/i, this.$listServers.bind(this, request, response));
	router.pm (_domain_, /HEAD|GET/i, this.$getServer.bind(this, request, response));
	router.pm (_domain_, /PUT/i,      this.$putServer.bind(this, request, response));
	router.pma(_editor_, /HEAD|GET/i, /html/i, this.$getServerEditor.bind(this, request, response));
	router.pmt(_editor_, /POST/i,     /urlencoded/i, this.$postServerEditor.bind(this, request, response));
	router.error(response);
};

// GET|HEAD /
ReflectorServer.prototype.$listServers = function(request, response) {
	var respond = Link.responder(response);
	// build headers
	var headerer = Link.headerer();
	headerer.addLink('/', 'self current collection');
	var servers = Environment.listServersById();
	var configs = [];
	for (var id in servers) {
		headerer.addLink('/'+servers[id].config.domain, 'item', { title:servers[id].config.domain });
		configs.push(servers[id].config);
	}

	if (/GET/i.test(request.method)) {
		// respond with data
		respond.ok('json', headerer).end(configs);
	} else {
		// respond with headers
		respond.ok(null, headerer).end();
	}
};

// GET|HEAD /:domain
ReflectorServer.prototype.$getServer = function(request, response, match) {
	var respond = Link.responder(response);
	var domain = match.path[1];
	var router = Link.router(request);
	// headers
	var headerer = Link.headerer();
	headerer.addLink('/', 'up via service collection');
	// find
	var server = Environment.getServerByDomain(domain);
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
				Local.promise(server.getSource()).then(
					function(source) {
						// send back html
						respond.ok('application/javascript', headerer).end(source);
					},
					function(err) { respond.badGateway(headerer).end(); }
				);
			});
			router.error(response);
		} else {
			// respond with headers
			respond.ok(null, headerer).end();
		}
	} else {
		respond.notFound().end();
	}
};

// PUT /:domain
ReflectorServer.prototype.$putServer = function(request, response, match) {
	var respond = Link.responder(response);
	var domain = match.path[1];
	var router = Link.router(request);
	// headers
	var headerer = Link.headerer();
	headerer.addLink('/', 'up via service collection');
	// find
	var server = Environment.getServerByDomain(domain);
	if (server) {
		// add links
		headerer.addLink('/'+domain, 'self current');
		router.t(/javascript/i, function() {
			if (server instanceof Environment.WorkerServer) {
				// shutdown the server
				Environment.killServer(server.config.id);
				// load a new server in-place with the given source
				Environment.addServer(domain, new Environment.WorkerServer({ script:request.body }));
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
};

// GET /:domain/editor
ReflectorServer.prototype.$getServerEditor = function(request, response, match) {
	var self = this;
	var respond = Link.responder(response);
	var domain = match.path[1];
	// headers
	var headerer = Link.headerer();
	headerer.addLink('/', 'via service collection');
	// find
	var server = Environment.getServerByDomain(domain);
	if (server) {
		// add links
		headerer.addLink('/'+domain, 'up item');
		headerer.addLink('/'+domain+'/editor', 'self current');
		if (/GET/i.test(request.method)) {
			// retrieve source
			Local.promise(server.getSource()).then(
				function(source) {
					// send back html
					respond.ok('html').end(self.renderServerEditorHtml(domain, source));
				},
				function(err) { respond.badGateway(headerer).end(); }
			);
		} else {
			// respond with headers
			respond.ok(null, headerer).end();
		}
	} else {
		respond.notFound().end();
	}
};

ReflectorServer.prototype.renderServerEditorHtml = function(domain, source) {
	return [
		'<p>Editing ',domain,'</p>',
		'<form action="httpl://',this.config.domain,'/',domain,'/editor" method="post">',
			'<textarea name="source" class="input-block-level" rows="20">',source,'</textarea>',
			'<a class="btn" href="httpl://',domain,'">Cancel</a> ',
			'<button type="submit" class="btn btn-primary">Reload</button>',
		'</form>'
	].join('');
};

// POST /:domain/editor
ReflectorServer.prototype.$postServerEditor = function(request, response, match) {
	var respond = Link.responder(response);
	var domain = match.path[1];
	var self = this;
	// headers
	var headerer = Link.headerer();
	headerer.addLink('/', 'via service collection');
	// find
	var server = Environment.getServerByDomain(domain);
	if (server) {
		// add links
		headerer.addLink('/'+domain, 'up item');
		headerer.addLink('/'+domain+'/editor', 'self current');
	
		if (server instanceof Environment.WorkerServer) {
			// shutdown the server
			Environment.killServer(server.config.id);
			// load a new server in-place with the given source
			Environment.addServer(domain, new Environment.WorkerServer({ script:request.body.source }));
			// respond by piping a request to the new server
			respond.pipe(Link.dispatch({ method:'get', url:'httpl://'+domain, headers:{ accept:'text/html' }}, this));
		} else {
			// can't live-update environment servers (...yet?)
			respond.respond([400, 'only worker servers can be live-updated']).end();
		}
	} else {
		respond.notFound().end();
	}
};
```