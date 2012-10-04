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
		};
		var router = new Http.Router();
		var domready = new Promise();
		var out_pending_requests = [];

		Agent.getId = function() { return Agent.config.agent_id; };
		Agent.getUri = function() { return Agent.config.agent_uri; };

		// http functions
		Agent.dispatch = function dispatch(request) {
			var p = new Promise();
			out_pending_requests.push(p);

			var mid = out_pending_requests.length - 1;
			postEventMsg('http:request', { mid:mid, request:request });

			return p;
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
							postEventMsg('yield', { uri:res.body });
						}
					});
				}
			}
		};

		// request handling functions
		Agent.addServer = function addServer(root_uri, server) {
			if (!server && typeof root_uri == 'object') {
				server = root_uri;
				root_uri = '';
			}
			router.addServer(root_uri, server);
		};

		// event handlers
		addEventMsgListener('setup', function(e) {
			Agent.config = e.config;
			Promise.whenAll([domready], function() {
				if (Agent.config.program_uri) {
					importScripts(Agent.config.program_uri);
				} else {
					// null program
					addEventMsgListener('dom:request', function(e) {
						Agent.dispatch(e.detail.request).then(Agent.renderResponse);
					});
					Agent.dom.listenEvent({ event:'request' }).then(function() {
						postEventMsg('ready');
					});
				}
			});
		});
		addEventMsgListener('kill', function(e) {
			// :TODO: let the program do cleanup?
			postEventMsg('dead'); // for now, just die immediately
		});
		addEventMsgListener('http:request', function(e) {
			// worker has received an http request
			router.dispatch(e.request).then(function(response) {
				postEventMsg('http:response', { mid:e.mid, response:response });
			});
		});
		addEventMsgListener('http:response', function(e) {
			// worker has received an http response
			var response = e.response;
			var pending_request = out_pending_requests[e.mid];
			if (!pending_request) { throw "Response received from agent worker with bad message id ("+e.mid+")"; }
			out_pending_requests[e.mid] = null;
			pending_request.fulfill(response);
		});

		// standard link reflections
		Agent.dispatch({ method:'get', uri:'#//dom.env', accept:'text/html' }).then(function(res) {
			Agent.dom = ReflectLinks(res.link, { agent:Agent.getId() });
			domready.fulfill(true);
		});

		// standard server
		var StdServer = {
			routes:[
				Http.route('session_validate', { uri:'.*' })
			],
			session_validate:function(request, match, session) {
				// :TODO:
				/*if (!session.hasPerm('session')) {
					return Http.response.badperms('session', session.getSrcDomain()+':'+session.getSrcProgram()+' connect to '+session.getDestDomain());
				}*/
			}
		};
		Agent.addServer(StdServer);
	})();
}

Util.logMode('errors', true);

// do some sandboxing
self.XMLHttpRequest = null; // ajax not allowed
// :TODO: importScripts
// :TODO: Worker
