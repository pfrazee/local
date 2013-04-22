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
		var self = this;
		var router = local.http.ext.router(request);
		var respond = local.http.ext.responder(response);
		router.mp ('HEAD', '/',         __httpListCollections.bind(self, request, respond));
		router.mpa('GET',  '/', /json/, __httpListCollections.bind(self, request, respond));
		router.mpt('POST', '/', /json/, __httpGenUniqueCollection.bind(self, request, respond));
		router.p(__path('^/:collection/?$'), function(match) {
			var cid = match.path[1];
			router.m ('HEAD',         __httpGetCollection.bind(self, request, respond, cid));
			router.ma('GET',  /json/, __httpGetCollection.bind(self, request, respond, cid));
			router.mt('POST', /json/, __httpAddItem.bind(self, request, respond, cid));
			router.m ('DELETE',       __httpDeleteCollection.bind(self, request, respond, cid));
			router.error(response, 'path');
		});
		router.p(__path('^/:collection/:item/?$'), function(match) {
			var cid = match.path[1];
			var iid = match.path[2];
			router.m ('HEAD',          __httpGetItem.bind(self, request, respond, cid, iid));
			router.ma('GET',   /json/, __httpGetItem.bind(self, request, respond, cid, iid));
			router.mt('PUT',   /json/, __httpSetItem.bind(self, request, respond, cid, iid));
			router.mt('PATCH', /json/, __httpUpdateItem.bind(self, request, respond, cid, iid));
			router.m ('DELETE',        __httpDeleteItem.bind(self, request, respond, cid, iid));
			router.error(response, 'path');
		});
		router.error(response);
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
		var headerer = local.http.ext.headerer();
		headerer.addLink('/', 'self current');
		headerer.addLink('/{title}', 'collection');
		Object.keys(this.collections).forEach(function(cid) {
			headerer.addLink('/'+cid, 'collection', { title:cid });
		});
		return headerer;
	}

	function __buildCollectionHeaders(cid) {
		var headerer = local.http.ext.headerer();
		headerer.addLink('/', 'up via service');
		if (cid) {
			headerer.addLink('/'+cid, 'self current');
			headerer.addLink('/'+cid+'/{title}', 'item');
		}
		return headerer;
	}

	function __buildItemHeaders(cid, iid) {
		var headerer = local.http.ext.headerer();
		headerer.addLink('/', 'via service');
		if (cid)
			headerer.addLink('/'+cid, 'up collection');
		if (iid)
			headerer.addLink('/'+cid+'/'+iid, 'self current');
		return headerer;
	}

	// GET /
	function __httpListCollections(request, respond) {
		if (/get/i.test(request.method))
			respond.ok('json', __buildServiceHeaders.call(this)).end(this.collections);
		else
			respond.ok(null, __buildServiceHeaders.call(this)).end();
	}

	// POST /
	function __httpGenUniqueCollection(request, respond) {
		var cid;
		do { cid = guid(); } while (typeof this.collections[cid] != 'undefined');
		this.collections[cid] = []; // now defined, not available

		var headers = __buildServiceHeaders.call(this);
		headers.location = '/'+cid;
		respond.created('json', headers).end({ id:cid });
	}

	// GET /:collection
	function __httpGetCollection(request, respond, cid) {
		if (/get/i.test(request.method))
			respond.ok('json', __buildCollectionHeaders.call(this, cid)).end(this.listCollectionItems(cid));
		else
			respond.ok(null, __buildCollectionHeaders.call(this, cid)).end();
	}

	// POST /:collection
	function __httpAddItem(request, respond, cid) {
		if (!request.body || typeof request.body != 'object')
			return respond.unprocessableEntity().end('request body required as a JSON object');

		this.setItem(cid, request.body);
		var headers = __buildCollectionHeaders.call(this, cid);
		headers.location = '/'+cid+'/'+request.body.id;
		respond.created('json', headers).end({ id:request.body.id });
	}

	// DELETE /:collection
	function __httpDeleteCollection(request, respond, cid) {
		this.removeCollection(cid);
		respond.noContent(null, __buildCollectionHeaders.call(this)).end();
	}

	// GET /:collection/:id
	function __httpGetItem(request, respond, cid, iid) {
		var item = this.getItem(cid, iid);
		if (item) {
			if (/get/i.test(request.method))
				respond.ok('json', __buildItemHeaders.call(this, cid, iid)).end(item);
			else
				respond.ok(null, __buildItemHeaders.call(this, cid, iid)).end();
		} else
			respond.notFound(null, __buildItemHeaders.call(this, cid)).end();
	}

	// PUT /:collection/:id
	function __httpSetItem(request, respond, cid, iid) {
		if (!request.body || typeof request.body != 'object')
			return respond.unprocessableEntity().end('request body required as a JSON object');

		request.body.id = iid;
		this.setItem(cid, request.body);
		respond.noContent(null, __buildItemHeaders.call(this, cid, iid)).end();
	}

	// PATCH /:collection/:id
	function __httpUpdateItem(request, respond, cid, iid) {
		if (!request.body || typeof request.body != 'object')
			return respond.unprocessableEntity().end('request body required as a JSON object');

		var item = this.getItem(cid, iid);
		if (item) {
			item = patch(item, request.body);
			this.setItem(cid, item);
			respond.noContent(null, __buildItemHeaders.call(this, cid, iid)).end();
		} else
			respond.notFound(null, __buildItemHeaders.call(this, cid)).end();
	}

	// DELETE /:collection/:id
	function __httpDeleteItem(request, respond, cid, iid) {
		this.removeItem(cid, iid);
		respond.noContent(null, __buildItemHeaders.call(this, cid)).end();
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