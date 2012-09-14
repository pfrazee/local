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
			router.addServer(uri, server);
		};

		// dom server wrappers
		Agent.dom = {
			dispatch:function(method, opt_query, opt_body, opt_type) { Agent.dispatch({ method:method, uri:'#/dom/'+Agent.getId(), query:opt_query, accept:'text/html', body:opt_body, 'content-type':opt_type }); },
			get:function(opt_selector) { Agent.dom.dispatch('get', { q:opt_selector }); },
			put:function(html, opt_selector) { Agent.dom.dispatch('put', { q:opt_selector }, html, 'text/html'); },
			appendChild:function(html, opt_selector, opt_child_index) { Agent.dom.dispatch('post', { q:opt_selector, append:opt_child_index }, html, 'text/html'); },
			insertBefore:function(html, opt_selector, opt_child_index) { Agent.dom.dispatch('post', { q:opt_selector, before:(opt_child_index || 0) }, html, 'text/html'); },
			replaceChild:function(html, opt_selector, opt_child_index) { Agent.dom.dispatch('post', { q:opt_selector, replace:opt_child_index }, html, 'text/html'); },
			deleteNode:function(opt_selector) { Agent.dom.dispatch('delete', { q:opt_selector }); },
			listen:function(event, opt_selector) { Agent.dispatch({ method:'listen', uri:'#/dom/'+Agent.getId()+'/'+event, query:{ qall:opt_selector } }); },
		};

		// event handlers
		addEventMsgListener('setup', function(e) {
			Agent.config = e.config;
			importScripts(Agent.config.program_url);
		});
		addEventMsgListener('kill', function(e) {
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
			// if !pendingRequest, make sure that the response wasnt accidentally sent twice
			Agent.pending_requests[e.mid] = null;
			pending_request.fulfill(response);
		});

	})();
}

Util.logMode('errors', true);

// do some sandboxing
self.XMLHttpRequest = null; // ajax not allowed
// :TODO: importScripts
// :TODO: Worker
