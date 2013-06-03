// Env Core
// ========

local.env.config = {
	workerBootstrapUrl : 'worker.min.js'
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
	local.web.registerLocal(domain, server.handleHttpRequest, server);

	return server;
};

local.env.killServer = function(domain) {
	var server = local.env.servers[domain];
	if (server) {
		local.web.unregisterLocal(domain);
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

// dispatch wrapper
// - allows the deployment to control request permissions / sessions / etc
// - adds the `origin` parameter to dispatch(), which is the object responsible for the request
var envDispatchWrapper;
local.web.setDispatchWrapper(function(request, response, dispatch, origin) {
	// parse the url
	var urld = local.web.parseUri(request.url); // (urld = url description)

	// if the urld has query parameters, extract them into the request's query object
	if (urld.query) {
		var q = local.web.contentTypes.deserialize(urld.query, 'application/x-www-form-urlencoded');
		for (var k in q)
			request.query[k] = q[k];
		delete urld.query; // avoid doing this again later
		urld.relative = urld.path + ((urld.anchor) ? ('#'+urld.anchor) : '');
		request.url = urld.protocol+'://'+urld.authority+urld.relative;
	}

	request.urld = urld;
	envDispatchWrapper.call(null, request, response, dispatch, origin);
});
local.env.setDispatchWrapper = function(fn) {
	envDispatchWrapper = fn;
};
local.env.setDispatchWrapper(function(request, response, origin, dispatch) {
	return dispatch(request, response);
});

// response html post-process
// - override this to modify html after it has entered the document
// - useful for adding local.env widgets
var postProcessRegion = function() {};
local.env.postProcessRegion = function(elem, containerElem) { return postProcessRegion(elem, containerElem); };
local.env.setRegionPostProcessor = function(fn) {
	postProcessRegion = fn;
};