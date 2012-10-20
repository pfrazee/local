var Env = (function() {
	// Env
	// ===
	// corrals the agents and HTTP traffic
	var Env = {
		init:Env__init,

		getAgent:Env__getAgent,
		makeAgent:Env__makeAgent,
		killAgent:Env__killAgent,

		requestSession:Env__requestSession,
		handleAuthChallenge:Env__handleAuthChallenge,

		router:null,
		agents:{}
	};
	
	// setup
	function Env__init(config) {
		this.config = config;

		this.router = new Http.Router();
		this.router.addServer('lap://dom.env', new DomServer());
		config.getContainerElem().addEventListener('request', Env__onRequestEvent);

		Sessions.init();
		RequestEvents.init(config.getContainerElem());
		Dropzones.init(config.getContainerElem());

		config.init();
	}

	function Env__onRequestEvent(e) {
		var node = e.target;
		var missed_body = true; // :HACK: was it a drop that just didnt hit the body elem?
		while (node) {
			if (node.classList && node.classList.contains('agent')) { break; }
			if (node.classList && node.classList.contains('agent-body')) { missed_body = false; }
			node = node.parentNode;
		}
		var agent = Env.getAgent(node);
		if (agent) {
			if (missed_body && /\.ui\/app/.test(e.detail.request.uri)) {
				// :HACK: should have hit the body -- redispatch there
				agent.emitDomRequestEvent(e.detail.request);
			} else {
				// agent didnt catch the event -- dispatch, but ignore the result
				agent.dispatch(e.detail.request);
			}
		} else {
			// create a new agent to handle the request
			agent = Env.makeAgent(null, { elem:e.target });
			agent.loadProgram(null).then(function() {
				Agent.genericDomEventHandler.call({ agent:agent }, e);
			});
		}
	}

	// agent get
	// - `id` can be the id or DOM node of the agent
	function Env__getAgent(id) {
		if (id instanceof Node) {
			var given_elem = id;
			id = (given_elem.id) ? given_elem.id.substr(6) /* remove 'agent-' */ : null;
		}
		if (id in Env.agents) {
			return Env.agents[id];
		}
		return null;
	}

	// agent create
	// - `id` can be null/undefined to create a new agent with an assigned id
	// - `id` can be the id or DOM node of the agent
	function Env__makeAgent(id, options) {
		options = options || {};

		if (id instanceof Node) {
			options.elem = id;
			id = (options.elem.id) ? options.elem.id.substr(6) /* remove 'agent-' */ : null;
		}
		if (id in this.agents) {
			return this.agents[id];
		}
		if (id === null || typeof id == 'undefined') {
			id = Env__makeAgentId.call(Env);
		}

		var el = Env__makeAgentWrapperElem.call(Env, id, options.elem);
		var toolbar = el.querySelector('.agent-titlebar-ctrls');
		if (options.noclose) { toolbar.removeChild(toolbar.querySelector('.btn-close')); }
		if (options.nocollapse) { toolbar.removeChild(toolbar.querySelector('.btn-shutter')); }

		var agent = new Agent(id, el);
		this.router.addServer(agent.getUri(), agent);

		return (this.agents[id] = agent);
	}
	
	var __next_agentid = 1;
	function Env__makeAgentId() {
		return __next_agentid++;
	}

	function Env__killAgent(id) {
		if (!(id in this.agents)) {
			return false;
		}

		var agent = this.agents[id];
		var elem = agent.getContainer();
		var dropzone = elem.previousSibling;

		var p = agent.killProgram();
		Promise.when(p, function() {
			elem.parentNode.removeChild(elem);
			Dropzones.cleanup(dropzone);
			this.router.removeServers(agent.getUri());
			delete this.agents[id];
		}, this);
		return p;
	}

	function Env__requestSession(agent, uri) {
		uri = (typeof uri == 'object') ? uri : Http.parseUri(uri);
		var p = new Promise();
		this.config.requestSession(agent, uri, function(permit, perms) {
			if (permit) {
				var sess = Sessions.make(agent);
				if (perms) { sess.addPerms(perms); }
				if (uri.protocol == 'lap') {
					sess.authscheme = 'LAPSession';
				}
				agent.sessions[uri.host] = sess;
				p.fulfill(sess);
			} else {
				p.fulfill(false);
			}
		});
		return p;
	}

	function Env__handleAuthChallenge(agent, request, challenge) {
		var session = agent.getSession(request.uri);
		session.authscheme = challenge.scheme;

		var p = new Promise();
		this.config.requestAuth({
			agent:agent,
			request:request,
			session:session,
			challenge:challenge
		}, function(try_again) {
			p.fulfill(try_again);
		});
		return p;
	}

	// Helpers
	// =======
	// generates HTML for agents to work within
	function Env__makeAgentWrapperElem(id, elem) {
		// create div
		var needs_appending = !elem;
		elem = elem || document.createElement('div');
		elem.className = "agent";
		elem.id = "agent-"+id;
		elem.innerHTML = agent_template_html
			.replace(/\{\{id\}\}/g, id)
			.replace(/\{\{uri\}\}/g, 'lap://'+id+'.ui')
		;
		if (needs_appending) {
			this.config.getContainerElem().querySelector('.defcolumn').appendChild(elem);
		}
		Dropzones.padAgent(elem);
		return elem;
	}
	var agent_template_html =
		//'<div id="agent-{{id}}" class="agent">' +
			'<div class="agent-titlebar">' +
				'<strong>{{id}}</strong>' + //'<strong>{{id}}</strong>&nbsp;<span class="agent-program"></span>' +
				'<form action="{{uri}}" target="{{id}}">' +
					'<div class="agent-titlebar-ctrls btn-group">' +
						'<button class="btn btn-mini btn-shutter" formmethod="min" title="collapse">_</button>' +
						'<button class="btn btn-mini btn-close" formmethod="close" title="close">&times;</button>' +
					'</div>' +
				'</form>' +
			'</div>' +
			'<div id="agent-{{id}}-body" class="agent-body"></div>'
		//'</div>'
	;

	return Env;
})();
