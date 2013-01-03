
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
	Environment.Server.call(this);
	this.state = Environment.Server.ACTIVE;
	this.collections = {};
}
StaticServer.prototype = Object.create(Environment.Server);

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
StaticServer.prototype.handleHttpRequest = function(request, response) {
	var self = this;
	var router = Link.router(request);
	var respond = Link.responder(response);
	router.pm('/', /HEAD|GET/i, self.handleListCollections.bind(self, request, respond));
	router.pm(reCollectionUrl, /HEAD|GET/i, function(match) {
		var cid = match.path[1];
		self.handleGetCollection(request, respond, cid);
	});
	router.pm(reItemUrl, /HEAD|GET/i,function(match) {
		var cid = match.path[1];
		var iid = match.path[2];
		self.handleGetItem(request, respond, cid, iid);
	});
	router.error(response);
};

// GET|HEAD /
StaticServer.prototype.handleListCollections = function(request, respond) {
	// build headers
	var headerer = Link.headerer();
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
};

// GET|HEAD /:collection
StaticServer.prototype.handleGetCollection = function(request, respond, cid) {
	// headers
	var headerer = Link.headerer();
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
};

// GET|HEAD /:collection/:id
StaticServer.prototype.handleGetItem = function(request, respond, cid, iid) {
	// headers
	var headerer = Link.headerer();
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
};