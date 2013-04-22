// Env Core
// ========

local.env.config = {
	workerBootstrapUrl : 'lib/worker.min.js'
};

local.env.servers = {};
local.env.clientRegions = {};
local.env.numServers = 0;
local.env.numClientRegions = 0;

local.env.addServer = function(domain, server) {
	// instantiate the application
	server.config.domain = domain;
	local.env.servers[domain] = server;
	local.env.numServers++;

	// allow the user script to load
	if (server.loadUserScript)
		server.loadUserScript();

	// register the server
	local.http.registerLocal(domain, server.handleHttpRequest, server);

	return server;
};

local.env.killServer = function(domain) {
	var server = local.env.servers[domain];
	if (server) {
		local.http.unregisterLocal(domain);
		server.terminate();
		delete local.env.servers[domain];
		local.env.numServers--;
	}
};

local.env.getServer = function(domain) { return local.env.servers[domain]; };
local.env.listFilteredServers = function(fn) {
	var list = {};
	for (var k in local.env.servers) {
		if (fn(local.env.servers[k], k)) list[k] = local.env.servers[k];
	}
	return list;
};

local.env.addClientRegion = function(clientRegion) {
	var id;
	if (typeof clientRegion == 'object')
		id = clientRegion.id;
	else {
		id = clientRegion;
		clientRegion = new local.client.Region(id);
	}
	local.env.clientRegions[clientRegion.id] = clientRegion;
	local.env.numClientRegions++;
	return clientRegion;
};

local.env.removeClientRegion = function(id) {
	if (local.env.clientRegions[id]) {
		local.env.clientRegions[id].terminate();
		delete local.env.clientRegions[id];
		local.env.numClientRegions--;
	}
};

local.env.getClientRegion = function(id) { return local.env.clientRegions[id]; };

// dispatch monkeypatch
// - allows the deployment to control request permissions / sessions / etc
// - adds the `origin` parameter, which is the object responsible for the request
var __envDispatchWrapper;
var orgLinkDispatchFn = local.http.dispatch;
local.http.dispatch = function(req, origin) {
	var res = __envDispatchWrapper.call(this, req, origin, orgLinkDispatchFn);
	if (res instanceof local.Promise) { return res; }

	// make sure we respond with a valid client response
	if (!res) {
		res = new local.http.ClientResponse(0, 'Environment did not correctly dispatch the request');
		res.end();
	} else if (!(res instanceof local.http.ClientResponse)) {
		if (typeof res == 'object') {
			var res2 = new local.http.ClientResponse(res.status, res.reason);
			res2.headers = res.headers;
			res2.end(res.body);
			res = res2;
		} else {
			res = new local.http.ClientResponse(0, res.toString());
			res.end();
		}
	}

	// and make sure it's wrapped in a promise
	var p = local.promise();
	if (res.status >= 400 || res.status === 0)
		p.reject(res);
	else
		p.fulfill(res);
	return p;
};
__envDispatchWrapper = function(req, origin, dispatch) {
	return dispatch(req);
};
local.env.setDispatchWrapper = function(fn) {
	__envDispatchWrapper = fn;
};

// response html post-process
// - override this to modify html after it has entered the document
// - useful for adding local.env widgets
var __postProcessRegion = function() {};
local.env.postProcessRegion = function(elem) { return __postProcessRegion(elem); };
local.env.setRegionPostProcessor = function(fn) {
	__postProcessRegion = fn;
};