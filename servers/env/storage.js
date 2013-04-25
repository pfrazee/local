// based on https://github.com/jeromegn/Backbone.localStorage
// thanks to jeromegn and contributors

(function(exports) {

	// StorageServer
	// =============
	// EXPORTED
	// generic collection storage, wraps the localStorage and sessionStorage APIs
	// - 'storageAPI' - an object which exports the localStorage/sessionStorage API
	function StorageServer(storageAPI) {
		local.env.Server.call(this);
		this.storage = storageAPI || localStorage;
		this.collections = {};
	}
	StorageServer.prototype = Object.create(local.env.Server.prototype);

	StorageServer.prototype.handleHttpRequest = function(request, response) {
		// :DEBUG: temporary helper fn
		var handled = false, self = this;
		function route(method, path, fn) {
			if (handled) return;
			if (method && path) {
				path = __path(path);
				if (path.test(request.path) && RegExp('^'+method+'$','i').test(request.method)) {
					handled = true;
					var match = path.exec(request.path);
					// (request, response, match1, match2, match3...)
					var args = [request, response].concat(match.slice(1));
					fn.apply(self, args);
				}
			} else
				response.writeHead(404,'not found').end();
		}

		route('HEAD',   '^/?$', __httpListCollections);
		route('GET',    '^/?$', __httpListCollections);
		route('POST',   '^/?$', __httpGenUniqueCollection);
		route('HEAD',   '^/:collection/?$', __httpGetCollection);
		route('GET',    '^/:collection/?$', __httpGetCollection);
		route('POST',   '^/:collection/?$', __httpAddItem);
		route('DELETE', '^/:collection/?$', __httpDeleteCollection);
		route('HEAD',   '^/:collection/:item/?$', __httpGetItem);
		route('GET',    '^/:collection/:item/?$', __httpGetItem);
		route('PUT',    '^/:collection/:item/?$', __httpSetItem);
		route('PATCH',  '^/:collection/:item/?$', __httpUpdateItem);
		route('DELETE', '^/:collection/:item/?$', __httpDeleteItem);
		route();
	};

	// gets (or creates) the collection and returns the keys of its items
	// - localstorage has no collection mechanism, so we have to manually track which items are in which collection
	StorageServer.prototype.getCollection = function(cid) {
		if (!this.collections[cid]) {
			var itemKeys = this.storage.getItem(cid);
			this.collections[cid] = (itemKeys) ? itemKeys.split(',') : [];
		}
		return this.collections[cid];
	};

	StorageServer.prototype.saveCollection = function(cid) {
		if (this.collections[cid])
			this.storage.setItem(cid, this.collections[cid].join(","));
	};

	StorageServer.prototype.removeCollection = function(cid) {
		if (this.collections[cid]) {
			this.collections[cid].forEach(function(iid) {
				this.storage.removeItem(cid+'-'+iid);
			}, this);
			this.storage.removeItem(cid);
			delete this.collections[cid];
		}
	};

	StorageServer.prototype.listCollectionItems = function(cid) {
		var collection = this.getCollection(cid);
		return collection
			.map(function(iid) { return this.getItem(cid, iid); }, this)
			.filter(function(item) { return item !== null; });
	};

	StorageServer.prototype.getItem = function(cid, iid) {
		try { return JSON.parse(this.storage.getItem(cid+'-'+iid)); }
		catch (e) { return null; }
	};

	StorageServer.prototype.setItem = function(cid, item) {
		// store item
		if (!item.id)
			item.id = guid();
		this.storage.setItem(cid+'-'+item.id, JSON.stringify(item));

		// update collection
		var collection = this.getCollection(cid);
		if (collection.indexOf(item.id.toString()) === -1) {
			collection.push(item.id.toString());
			this.saveCollection(cid);
		}
	};

	StorageServer.prototype.removeItem = function(cid, iid) {
		var collection = this.getCollection(cid);
		this.collections[cid] = collection.filter(function(iid2) { return iid != iid2; });
		this.saveCollection(cid);
		this.storage.removeItem(cid+'-'+iid);
	};

	// INTERNAL
	// ========

	function S4() {
		return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
	}

	function guid() {
		return (S4()+S4()+"-"+S4()+"-"+S4()+"-"+S4()+"-"+S4()+S4()+S4());
	}

	// helps produce nice-looking routes
	function __path(str) {
		return new RegExp(str.replace(/\:collection/g, '([A-z0-9_\\-]+)').replace(/\:item/g, '([^/]+)'));
	}

	function __buildServiceHeaders() {
		var headers = {
			link:[
				{ href:'/', rel:'self current' },
				{ href:'/{title}', rel:'collection' }
			]
		};
		Object.keys(this.collections).forEach(function(cid) {
			headers.link.push({ href:'/'+cid, rel:'collection', title:cid });
		});
		return headers;
	}

	function __buildCollectionHeaders(cid) {
		var headers = {
			link:[{ href:'/', rel:'up via service' }]
		};
		if (cid) {
			headers.link.push({ href:'/'+cid, rel:'self current' });
			headers.link.push({ href:'/'+cid+'/{title}', rel:'item' });
		}
		return headers;
	}

	function __buildItemHeaders(cid, iid) {
		var headers = {
			link:[{ href:'/', rel:'via service' }]
		};
		if (cid)
			headers.link.push({ href:'/'+cid, rel:'up collection' });
		if (iid)
			headers.link.push({ href:'/'+cid+'/'+iid, rel:'self current' });
		return headers;
	}

	// GET /
	function __httpListCollections(request, response) {
		var headers = __buildServiceHeaders.call(this);
		if (/get/i.test(request.method)) {
			headers['content-type'] = 'application/json';
			response.writeHead(200, 'ok', headers).end(this.collections);
		} else
			response.writeHead(200, 'ok', headers).end();
	}

	// POST /
	function __httpGenUniqueCollection(request, response) {
		var cid;
		do { cid = guid(); } while (typeof this.collections[cid] != 'undefined');
		this.collections[cid] = []; // now defined, not available

		var headers = __buildServiceHeaders.call(this);
		headers.location = '/'+cid;
		headers['content-type'] = 'application/json';
		response.writeHead(201, 'created', headers).end({ id:cid });
	}

	// GET /:collection
	function __httpGetCollection(request, response, cid) {
		var headers = __buildCollectionHeaders.call(this, cid);
		if (/get/i.test(request.method)) {
			headers['content-type'] = 'application/json';
			response.writeHead(200, 'ok', headers).end(this.listCollectionItems(cid));
		} else
			response.writeHead(200, 'ok', headers).end();
	}

	// POST /:collection
	function __httpAddItem(request, response, cid) {
		if (!request.body || typeof request.body != 'object')
			return response.writeHead(422, 'unprocessable entity').end('request body required as a JSON object');

		this.setItem(cid, request.body);
		var headers = __buildCollectionHeaders.call(this, cid);
		headers.location = '/'+cid+'/'+request.body.id;
		headers['content-type'] = 'application/json';
		response.writeHead(201, 'created', headers).end({ id:request.body.id });
	}

	// DELETE /:collection
	function __httpDeleteCollection(request, response, cid) {
		this.removeCollection(cid);
		response.writeHead(204, 'no content', __buildCollectionHeaders.call(this, cid)).end();
	}

	// GET /:collection/:id
	function __httpGetItem(request, response, cid, iid) {
		var headers = __buildItemHeaders.call(this, cid, iid);
		var item = this.getItem(cid, iid);
		if (item) {
			if (/get/i.test(request.method)) {
				headers['content-type'] = 'application/json';
				response.writeHead(200, 'ok', headers).end(item);
			} else
				response.writeHead(200, 'ok', headers).end();
		} else
			response.writeHead(404, 'not found', headers).end();
	}

	// PUT /:collection/:id
	function __httpSetItem(request, response, cid, iid) {
		if (!request.body || typeof request.body != 'object')
			return response.writeHead(422, 'unprocessable entity').end('request body required as a JSON object');

		request.body.id = iid;
		this.setItem(cid, request.body);
		response.writeHead(204, 'no content', __buildItemHeaders.call(this, cid, iid)).end();
	}

	// PATCH /:collection/:id
	function __httpUpdateItem(request, response, cid, iid) {
		if (!request.body || typeof request.body != 'object')
			return response.writeHead(422, 'unprocessable entity').end('request body required as a JSON object');

		var item = this.getItem(cid, iid);
		if (item) {
			item = patch(item, request.body);
			this.setItem(cid, item);
			response.writeHead(204, 'no content', __buildItemHeaders.call(this, cid, iid)).end();
		} else
			response.writeHead(404, 'not found', __buildItemHeaders.call(this, cid, iid)).end();
	}

	// DELETE /:collection/:id
	function __httpDeleteItem(request, response, cid, iid) {
		this.removeItem(cid, iid);
		response.writeHead(204, 'no content', __buildItemHeaders.call(this, cid, iid)).end();
	}

	// brings updates into org value
	// :NOTE: mutates its first parameter out of laziness
	function patch(org, update) {
		if (update === null) { return null; }
		if (org === null) { org = {}; }
		for (var k in update) {
			if (typeof org[k] == 'object' && typeof update[k] == 'object')
				org[k] = patch(org[k], update[k]);
			else
				org[k] = update[k];
		}
		return org;
	}

	exports.StorageServer = StorageServer;
})(window);