// based on https://github.com/jeromegn/Backbone.localStorage
// thanks to jeromegn and contributors

// generate four random hex digits.
function S4() {
   return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
}

// generate a pseudo-GUID by concatenating random hexadecimal.
function guid() {
   return (S4()+S4()+"-"+S4()+"-"+S4()+"-"+S4()+"-"+S4()+S4()+S4());
}

// LocalStorageServer
// ==================
// wraps the document's localstorage api
var reCollectionUrl = new RegExp('^/([A-z0-9_\\-]+)/?$'); // /:collection
var reItemUrl = new RegExp('^/([A-z0-9_\\-]+)/([^/]+)/?$'); // /:collection/:item
function LocalStorageServer() {
	Environment.Server.call(this);
	this.state = Environment.Server.ACTIVE;
	this.collections = {};
	// :TODO: load collections from a fixed name?
}
LocalStorageServer.prototype = Object.create(Environment.Server.prototype);

// request router
LocalStorageServer.prototype.handleHttpRequest = function(request, response) {
	var self = this;
	var router = Link.router(request);
	var respond = Link.responder(response);
	router.mp('HEAD', '/', self.listCollections.bind(self, request, respond));
	router.mpa('GET', '/', 'application/json', self.listCollections.bind(self, request, respond));
	router.p(reCollectionUrl, function(match) {
		var cid = match.path[1];
		router.m('HEAD', self.getCollection.bind(self, request, respond, cid));
		router.ma('GET', 'application/json', self.getCollection.bind(self, request, respond, cid));
		router.mt('POST', 'application/json', self.addItem.bind(self, request, respond, cid));
		router.m('DELETE', self.deleteCollection.bind(self, request, respond, cid));
		router.error(response, 'path');
	});
	router.p(reItemUrl, function(match) {
		var cid = match.path[1];
		var iid = match.path[2];
		router.m('HEAD', self.getItem.bind(self, request, respond, cid, iid));
		router.ma('GET', 'application/json', self.getItem.bind(self, request, respond, cid, iid));
		router.mt('PUT', 'application/json', self.setItem.bind(self, request, respond, cid, iid));
		router.m('DELETE', self.deleteItem.bind(self, request, respond, cid, iid));
		router.error(response, 'path');
	});
	router.error(response);
};

// helper: gets (or creates) the collection and returns the keys of its items
// - localstorage has no collection mechanism, so we have to manually track which items are in which collection
LocalStorageServer.prototype._getCollection = function(cid) {
	if (!this.collections[cid]) {
		var store = localStorage.getItem(cid);
		if (store) {
			this.collections[cid] = store.split(',');
		} else {
			this.collections[cid] = [];
		}
	}
	return this.collections[cid];
};

// helper: stores the collection's set of keys in storage
LocalStorageServer.prototype._saveCollection = function(cid) {
	if (this.collections[cid]) {
		localStorage.setItem(cid, this.collections[cid].join(","));			
	}
};

// helper: retrieves the item
LocalStorageServer.prototype._getItem = function(cid, iid) {
	try {
		return JSON.parse(localStorage.getItem(cid+'-'+iid));
	} catch (e) {
		return null;
	}
};

// helper: stores the item
LocalStorageServer.prototype._setItem = function(cid, iid, v) {
	localStorage.setItem(cid+'-'+iid, JSON.stringify(v));
};

// produce headers for service resource
LocalStorageServer.prototype.buildServiceHeaders = function() {
	var headerer = Link.headerer();
	headerer.addLink('/', 'self current');
	headerer.addLink('/{collection}', 'collection');
	Object.keys(this.collections).forEach(function(cid) {
		headerer.addLink('/'+cid, 'collection', { title:cid });
	});
	return headerer;
};

// produce headers for collection resources
LocalStorageServer.prototype.buildCollectionHeaders = function(cid) {
	var headerer = Link.headerer();
	headerer.addLink('/', 'up via service');
	if (cid) {
		headerer.addLink('/'+cid, 'self current');
		headerer.addLink('/'+cid+'/{item}', 'item');
	}
	return headerer;
};

// produce headers for item resources
LocalStorageServer.prototype.buildItemHeaders = function(cid, iid) {
	var headerer = Link.headerer();
	headerer.addLink('/', 'via service');
	if (cid) {
		headerer.addLink('/'+cid, 'up collection');
	}
	if (iid) {
		headerer.addLink('/'+cid+'/'+iid, 'self current');
	}
	return headerer;
};

// GET /
LocalStorageServer.prototype.listCollections = function(request, respond) {
	if (/get/i.test(request.method)) {
		// respond with data
		respond.ok('json', this.buildServiceHeaders()).end(this.collections);
	} else {
		// respond with headers
		respond.ok(null, this.buildServiceHeaders()).end();		
	}
};

// GET /:collection
LocalStorageServer.prototype.getCollection = function(request, respond, cid) {
	var collection = this._getCollection(cid);
	if (/get/i.test(request.method)) {
		// respond with data
		var items = collection
			.map(function(iid) { return this._getItem(cid, iid); }, this)
			.filter(function(item) { return item !== null; });
		respond.ok('json', this.buildCollectionHeaders(cid)).end(items);
	} else {
		// respond with headers
		respond.ok(null, this.buildCollectionHeaders(cid)).end();
	}
};

// POST /:collection
LocalStorageServer.prototype.addItem = function(request, respond, cid) {
	// store item
	var item = request.body;
	if (!item.id) {
		item.id = guid();
	}
	this._setItem(cid, item.id, item);

	// update collection
	var collection = this._getCollection(cid);
	collection.push(item.id.toString());
	this._saveCollection(cid);

	// respond
	var headers = this.buildCollectionHeaders(cid);
	headers.addLink('/'+cid+'/'+item.id, 'item', { title:'created' });
	respond.ok(null, headers).end();
};

// DELETE /:collection
LocalStorageServer.prototype.deleteCollection = function(request, respond, cid) {
	if (this.collections[cid]) {
		// delete contained items from local storage
		this.collections[cid].forEach(function(iid) {
			localStorage.removeItem(cid+'-'+iid);
		});
		// delete collection
		localStorage.removeItem(cid);
		// drop reference
		delete this.collections[cid];
	}
	respond.ok(null, this.buildCollectionHeaders()).end();
};

// GET /:collection/:id
LocalStorageServer.prototype.getItem = function(request, respond, cid, iid) {
	var item = this._getItem(cid, iid);
	if (item) {
		if (/get/i.test(request.method)) {
			// respond with data
			respond.ok('json', this.buildItemHeaders(cid, iid)).end(item);
		} else {
			// respond with headers
			respond.ok(null, this.buildItemHeaders(cid, iid)).end();
		}
	} else {
		respond.notFound(null, this.buildItemHeaders(cid)).end();
	}
};

// PUT /:collection/:id
LocalStorageServer.prototype.setItem = function(request, respond, cid, iid) {
	// store item data
	this._setItem(cid, iid, request.body);

	// add to the collection, if new
	var collection = this._getCollection(cid);
	if (collection.indexOf(iid) === -1) {
		collection.push(iid);
		this._saveCollection(cid);
	}
	respond.ok(null, this.buildItemHeaders(cid, iid)).end();
};

// PATCH /:collection/:id
LocalStorageServer.prototype.setItem = function(request, respond, cid, iid) {
	var item = this._getItem(cid, iid);
	if (item) {
		// update and store
		item = patch(item, request.body);
		this._setItem(cid, iid, request.body);
		respond.ok(null, this.buildItemHeaders(cid, iid)).end();
	} else {
		respond.notFound(null, this.buildItemHeaders(cid)).end();
	}
};

// DELETE /:collection/:id
LocalStorageServer.prototype.deleteItem = function(request, respond, cid, iid) {
	// remove item data
	localStorage.removeItem(cid+'-'+iid);

	// remove from collection
	var collection = this._getCollection(cid);
	this.collections[cid] = collection.filter(function(iid2) { return iid != iid2; });
	this._saveCollection(cid);

	respond.ok(null, this.buildItemHeaders(cid)).end();
};

// brings updates into org value
// :NOTE: mutates its first parameter out of laziness
function patch(org, update) {
	if (update === null) { return null; }
	if (org === null) { org = {}; }
	for (var k in update) {
		if (typeof org[k] == 'object' && typeof update[k] == 'object') {
			org[k] = patch(org[k], update[k]);
		} else {
			org[k] = patch[k];
		}
	}
	return org;
}