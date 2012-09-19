// Agent Worker
// ============
// program setup for agent workers

importScripts('/stdlib/globals.js');
importScripts('/stdlib/msgevents.js');
importScripts('/stdlib/util.js');
importScripts('/stdlib/promise.js');
importScripts('/stdlib/contenttypes.js');
importScripts('/stdlib/http.js');
importScripts('/stdlib/linkreflector.js');

if (typeof Agent == 'undefined') {
	(function() {
		globals.Agent = {
			pending_requests:[]
		};
		var router = new Http.Router();
		var domready = new Promise();

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
		Agent.renderResponse = function renderResponse(response, opt_noyield) {
			if (response.code == 204 || response.code == 205) { return; }

			var body = response.body;
			if (body) {
				body = ContentTypes.serialize(body, response['content-type']);
				Agent.dom.putNode({}, body, 'text/html');

				if (!opt_noyield) {
					Agent.dom.getNode({ selector:'script.program', attr:'src' }).then(function(res) {
						if (res.code == 200 && res.body) {
							postEventMsg('yield', { url:res.body });
						}
					});
				}
			}
		};

		// request handling functions
		Agent.addServer = function addServer(uri, server) {
			router.addServer(uri, server);
		};

		// event handlers
		addEventMsgListener('setup', function(e) {
			Agent.config = e.config;
			Promise.whenAll([domready], function() {
				importScripts(Agent.config.program_url);
			});
		});
		addEventMsgListener('kill', function(e) {
			// :TODO: let the program do cleanup?
			postEventMsg('dead'); // for now, just die immediately
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
			// if you get a !pendingRequest, make sure that the response wasnt accidentally sent twice
			Agent.pending_requests[e.mid] = null;
			pending_request.fulfill(response);
		});

		// standard link reflections
		Agent.dispatch({ method:'get', uri:'#//dom', accept:'text/html' }).then(function(res) {
			Agent.dom = ReflectLinks(res.link, { agent:Agent.getId() });
			domready.fulfill(true);
		});
	})();
}

Util.logMode('errors', true);

// do some sandboxing
self.XMLHttpRequest = null; // ajax not allowed
// :TODO: importScripts
// :TODO: Worker
