if (typeof DomServer == 'undefined') {
	(function() {
		globals.DomServer = function() {

		};

		DomServer.prototype.routes = [
			Http.route('banner', { method:'get', uri:'^/?$', accept:'text/.*' }), // /
			Http.route('agentperms', { uri:'^/agent/?.*' }), // /agent/...
			Http.route('makeagent', { method:'post', uri:'^/agent/?$', accept:'application/json' }), // /agent
			Http.route('get', { method:'get', uri:'^/agent/([^/]*)/node/?$', accept:'text/.*' }), // /agent/:agent/node
			Http.route('put', { method:'put', uri:'^/agent/([^/]*)/node/?$', 'content-type':'text/.*' }), // /agent/:agent/node
			Http.route('ins', { method:'post', uri:'^/agent/([^/]*)/node/?$', 'content-type':'text/.*' }), // /agent/:agent/node
			Http.route('del', { method:'delete', uri:'^/agent/([^/]*)/node/?$' }), // /agent/:agent/node
			Http.route('event', { method:'listen|unlisten|trigger', uri:'^/agent/([^/]*)/event/([^/]*)/?$' }) // /agent/:agent/event/:event
		];

		DomServer.prototype.banner = function DomServer__banner() {
			var linkHeader = [
				{ methods:['post'], rel:'Agent', href:'lsh://dom.env/agent', type:'application/json' },
				{ methods:['get','put','post','delete'], rel:'Node', href:'lsh://dom.env/agent/{agent}/node?{selector}&{selectorAll}&{attr}&{append}&{before}&{replace}&{add}&{remove}&{toggle}', type:'text/html' },
				{ methods:['listen', 'unlisten', 'trigger'], rel:'Event', href:'lsh://dom.env/agent/{agent}/event/{event}?{selector}' }
			];
			return Http.response([200,'ok'], 'Dom Server 0.1', 'text/html', { link:linkHeader });
		};

		DomServer.prototype.agentperms = function DomServer__agentperms(request, match) {
			if (!request.authorization) {
				return Http.response.badperms(); // ask for a session (no perms needed)
			}
		};

		DomServer.prototype.makeagent = function DomServer__makeagent(request, match) {
			var params = request.body || {};
			var agent = Env.makeAgent();

			var p = new Promise();
			agent.loadProgram(params.program || null, params.config).then(function() {
				if (params.request) {
					agent.postWorkerEvent('dom:request', { detail:{ request:params.request }});
				}
				p.fulfill(Http.response([200,'ok'], { id:agent.getId() }, 'application/json'));
			});
			return p;
		};

		DomServer.prototype.get = function DomServer__get(request, match) {
			var agent = Env.getAgent(match.uri[1]);

			if (request.authorization.agent != agent.getId()) {
				return Http.response([403,'can not access other agent doms']);
			}
			
			var nodes = getNodes(agent, request.query);
			if (nodes.length === 0) {
				return Http.response([404,'node(s) not found']);
			}

			var val = '';
			var attr = request.query.attr || 'innerHTML';
			nodes.forEach(function(node) {
				val += node[attr];
			});

			var type = (/html/i.test(attr)) ? 'text/html' : 'text/plain';
			return Http.response([200,'ok'], val, type);
		};

		DomServer.prototype.put = function DomServer__put(request, match) {
			var agent = Env.getAgent(match.uri[1]);

			if (request.authorization.agent != agent.getId()) {
				return Http.response([403,'can not access other agent doms']);
			}
			
			var nodes = getNodes(agent, request.query);
			if (nodes.length === 0) {
				return Http.response([404,'node(s) not found']);
			}

			var val = request.body ? request.body.toString() : '';
			var attr = request.query.attr || 'innerHTML';
			nodes.forEach(function(node) {
				node[attr] = val;
			});

			return Http.response([204,'ok']);
		};

		DomServer.prototype.ins = function DomServer__ins(request, match) {
			var agent = Env.getAgent(match.uri[1]);

			if (request.authorization.agent != agent.getId()) {
				return Http.response([403,'can not access other agent doms']);
			}
			
			var nodes = getNodes(agent, request.query);
			if (nodes.length === 0) {
				return Http.response([404,'node(s) not found']);
			}

			var val = request.body ? request.body.toString() : '';
			var attr = request.query.attr || 'innerHTML';
			nodes.forEach(function(node) {
				if (!attr || /html/i.test(attr)) {
					// (can't just do frag.innerHTML = html)
					var el = document.createElement('div');
					el.innerHTML = val;
					var frag = document.createDocumentFragment();
					while (el.childNodes.length) {
						var chel = el.removeChild(el.childNodes[0]);
						frag.appendChild(chel);
					}

					var added = false;
					if ('before' in request.query) {
						node.insertBefore(frag, node.childNodes[request.query.before]);
						added = true;
					}
					if ('replace' in request.query) {
						node.replaceChild(frag, node.childNodes[request.query.replace]);
						added = true;
					}
					if (!added || 'append' in request.query) {
						node.appendChild(frag);
					}
				} else if (attr == 'class') {
					if ('remove' in request.query) {
						node.classList.remove(val);
					} else if ('toggle' in request.query) {
						node.classList.toggle(val);
					} else {
						node.classList.add(val);
					}
				}
			});

			return Http.response([204,'ok']);
		};

		DomServer.prototype.del = function DomServer__del(request, match) {
			var agent = Env.getAgent(match.uri[1]);

			if (request.authorization.agent != agent.getId()) {
				return Http.response([403,'can not access other agent doms']);
			}

			var nodes = getNodes(agent, request.query);
			if (nodes.length === 0) {
				return Http.response([404,'node(s) not found']);
			}

			nodes.forEach(function(node) {
				node.parentNode.removeChild(node);
			});

			return Http.response([204,'ok']);
		};

		DomServer.prototype.event = function DomServer__event(request, match) {
			var agent = Env.getAgent(match.uri[1]);

			// :TODO: maaaybe with permissions of some kind
			if (request.authorization.agent != agent.getId()) {
				return Http.response([403,'can not access other agent doms']);
			}

			switch (request.method) {
				case 'listen':
					agent.addDomEventHandler(match.uri[2], request.query.selector);
					break;
				case 'unlisten':
					agent.removeDomEventHandler(match.uri[2], request.query.selector);
					break;
				case 'trigger':
					agent.postWorkerEvent('dom:'+match.uri[2], request.body);
					break;
				default:
					return Http.response([405,'method not supported']);
			}

			return Http.response([204,'ok']);
		};

		function getNodes(agent, query) {
			if (!agent) { return []; }

			var body = agent.getBody();
			if (!query || (!query.selector && !query.selectorAll)) {
				return [body];
			}

			var nodes = query.selectorAll ?
				body.querySelectorAll(query.selectorAll) :
				[body.querySelector(query.selector)];

			var nodearr = [];
			for (var i=0, ii=nodes.length; i < ii; i++) {
				if (!nodes[i]) { continue; }
				nodearr.push(nodes[i]);
			}
			return nodearr;
		}
	})();
}
