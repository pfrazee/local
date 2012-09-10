// Agent Worker
// ============
// program setup for agent workers

importScripts('/stdlib/globals.js');
importScripts('/stdlib/msgevents.js');
importScripts('/stdlib/util.js');
importScripts('/stdlib/promise.js');
importScripts('/stdlib/contenttypes.js');
importScripts('/stdlib/httprouter.js');

if (typeof Agent == 'undefined') {
	(function() {
		globals.Agent = {
			pending_requests:[]
		};
		var router = new HttpRouter();

		Agent.getId = function() { return Agent.config.agent_id; };
		Agent.getUri = function() { return Agent.config.agent_uri; };

		// http functions
        Agent.dispatch = function dispatch(request, opt_follow) {
            var p = new Promise();
            var mid = Agent.pending_requests.length;

            Agent.pending_requests.push(p);
            postEventMsg('http:request', { mid:mid, request:request, follow:opt_follow });

            return p;
        };
        Agent.follow = function follow(request) {
        	return Agent.dispatch(request, true);
        };

        // request handling functions
        Agent.addServer = function addServer(uri, server) {
        	router.addModule(uri, server);
        };

        // event handlers
		addEventMsgListener('setup', function(e) {
			Agent.config = e.config;
			importScripts(Agent.config.program_url);
		});
		addEventMsgListener('http:request', function(e) {
			router.dispatch(e.request).then(function(response) {
				postEventMsg('http:response', { mid:e.mid, response:response });
			});
		});
		addEventMsgListener('http:response', function(e) {
			var response = e.response;
	        var pending_request = Agent.pending_requests[e.mid];
	        if (!pending_request) { throw "Response received from agent worker with bad message id"; }
	        // if !pendingRequest, make sure that the response wasnt accidentally sent twice
	        Agent.pending_requests[e.mid] = null;
	        pending_request.fulfill(response);
		});

	})();
}

// do some sandboxing
self.XMLHttpRequest = null; // ajax not allowed