(function(exports) {
	var cur_iid = 0;
	function geniid() {
		return cur_iid++;
	}

	// StaticServer
	// ============
	// provides simple static data hosting
	// - all content is added through the server object's method interface
	// - all content may be retrieved via GET requests
	var reCollectionUrl = new RegExp('^/([A-z0-9_]+)/?$'); // /:collection
	var reItemUrl = new RegExp('^/([A-z0-9_]+)/([^/]+)/?$'); // /:collection/:item
	function StaticServer() {
		local.env.Server.call(this);
		this.collections = {};
	}
	exports.StaticServer = StaticServer;
	StaticServer.prototype = Object.create(local.env.Server.prototype);

	// use this to populate the server
	StaticServer.prototype.addCollection = function(cid, Type) {
		Type = Type || Object;
		this.collections[cid] = this.collections[cid] || (new Type());
		return this.collections[cid];
	};

	// use this to populate the server
	// - `iid` is optional, and should only be used on Object collection types
	StaticServer.prototype.addCollectionItem = function(cid, iid, v) {
		if (typeof v == 'undefined') {
			v = iid;
			iid = undefined;
		}
		var collection = this.collections[cid] || this.addCollection(cid);
		iid = iid || geniid();
		collection[iid] = v;
	};

	// request router
	function httpHttpRequest(request, response) {
		var self = this;
		var router = local.http.ext.router(request);
		var respond = local.http.ext.responder(response);
		router.pm('/', /HEAD|GET/i, httpListCollections.bind(self, request, respond));
		router.pm(reCollectionUrl, /HEAD|GET/i, function(match) {
			var cid = match.path[1];
			httpGetCollection.call(self, request, respond, cid);
		});
		router.pm(reItemUrl, /HEAD|GET/i,function(match) {
			var cid = match.path[1];
			var iid = match.path[2];
			httpGetItem.call(self, request, respond, cid, iid);
		});
		router.error(response);
	}

	// GET|HEAD /
	function httpListCollections(request, respond) {
		// build headers
		var headerer = local.http.ext.headerer();
		headerer.addLink('/', 'self current');
		headerer.addLink('/{collection}', 'collection');
		Object.keys(this.collections).forEach(function(cid) {
			headerer.addLink('/'+cid, 'collection', { title:cid });
		});

		if (/get/i.test(request.method)) {
			// respond with data
			respond.ok('json', headerer).end(this.collections);
		} else {
			// respond with headers
			respond.ok(null, headerer).end();
		}
	}

	// GET|HEAD /:collection
	function httpGetCollection(request, respond, cid) {
		// headers
		var headerer = local.http.ext.headerer();
		headerer.addLink('/', 'up via service');
		// find
		var collection = this.collections[cid];
		if (collection) {
			// add links
			headerer.addLink('/'+cid, 'self current');
			headerer.addLink('/'+cid+'/{item}', 'item');
			if (/get/i.test(request.method)) {
				// respond with data
				respond.ok('json', headerer).end(collection);
			} else {
				// respond with headers
				respond.ok(null, headerer).end();
			}
		} else {
			respond.notFound().ok();
		}
	}

	// GET|HEAD /:collection/:id
	function httpGetItem(request, respond, cid, iid) {
		// headers
		var headerer = local.http.ext.headerer();
		headerer.addLink('/', 'via service');
		// find
		var collection = this.collections[cid];
		if (collection) {
			// add links
			headerer.addLink('/'+cid, 'up collection');
			// find
			var item = collection[iid];
			if (item) {
				// add links
				headerer.addLink('/'+cid+'/'+iid, 'self current');
				if (/get/i.test(request.method)) {
					// respond with data
					respond.ok('json', headerer).end(item);
				} else {
					// respond with headers
					respond.ok(null, headerer).end();
				}
				return;
			}
		}
		respond.notFound(null, headerer).end();
	}
})(window);