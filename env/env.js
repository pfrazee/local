var Env = (function() {
	// Env
	// ===
	// corrals the agents and HTTP traffic
	var Env = {
		init:Env__init,

		getAgent:Env__getAgent,
		makeAgent:Env__makeAgent,
		killAgent:Env__killAgent,

		handleAuthChallenge:Env__handleAuthChallenge,

		router:null,
		agents:{},

		is_loaded:new Promise()
	};
	
	// setup
	function Env__init(container_elem_id) {
		this.router = new Http.Router();
		this.router.addServer('lsh://dom.env', new DomServer());

		this.container_elem = document.getElementById(container_elem_id);
		document.body.addEventListener('request', Env__onRequestEvent);

		Sessions.init();
		RequestEvents.init();
		Dropzones.init(this.container_elem);

		// send is_loaded signal
		this.is_loaded.fulfill(true);
	}

	function Env__onRequestEvent(e) {
		// this handler is called when no agent program is there to catch it first

		// try to find owning agent
		var agent_id = null;
		var node = e.target;
		while (node) {
			if (node.classList && node.classList.contains('agent')) {
				agent_id = node;
				break;
			}
			node = node.parentNode;
		}

		var agent = Env.getAgent(agent_id);
		if (agent) {
			// agent didnt catch the event -- dispatch, but ignore the result
			agent.dispatch(e.detail.request, ['connection']);
		} else {
			// create a new agent to handle the request
			agent = Env.makeAgent(agent_id, { elem:e.target });
			Agent.genericDomEventHandler.call({ agent:agent }, e);
		}
	}

	// agent get
	// - `id` can be the id or DOM node of the agent
	function Env__getAgent(id) {
		if (typeof id == 'object' && id instanceof Node) { // this may be the worst code in the project
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
		// :TODO: this function could use a cleanup

		options = options || {};
		if (typeof id == 'object' && id instanceof Node) { // this may be the second worst code in the project
			options.elem = id;
			id = (options.elem.id) ? options.elem.id.substr(6) /* remove 'agent-' */ : null;
		}

		if (id === null || typeof id == 'undefined') {
			id = Env__makeAgentId.call(Env);
		}

		if (id in this.agents) {
			return this.agents[id];
		}

		// add container elem to dom
		var agent_elem = Env__makeAgentWrapperElem(id, options.elem);
		if (!options.elem) {
			this.container_elem.querySelector('.defcolumn').appendChild(agent_elem);
		}
		Dropzones.padAgent(agent_elem);

		var toolbar_ctrls = agent_elem.querySelector('.agent-titlebar-ctrls');
		if (options.noclose) { toolbar_ctrls.removeChild(toolbar_ctrls.querySelector('.btn-close')); }
		if (options.nocollapse) { toolbar_ctrls.removeChild(toolbar_ctrls.querySelector('.btn-shutter')); }

		// drag/drop render-state managers
		// :TODO: put in the agent constructor or member function?
		agent_elem.addEventListener('dragenter', function(e) {
			agent_elem.classList.add('request-hover');
		});
		agent_elem.addEventListener('dragleave', function(e) {
			// dragleave is fired on all children, so only pay attention if it dragleaves our region
			var rect = agent_elem.getBoundingClientRect();
			if (e.x >= (rect.left + rect.width) || e.x <= rect.left || e.y >= (rect.top + rect.height) || e.y <= rect.top) {
				agent_elem.classList.remove('request-hover');
			}
		});
		agent_elem.addEventListener('drop', function(e) {
			agent_elem.classList.remove('request-hover');
		});

		// create agent
		var agent = new Agent(id, agent_elem);
		this.router.addServer(agent.getUri(), agent);
        agent.loadProgram(null);

		return (this.agents[id] = agent);
	}
	
	function Env__makeAgentId() {
		for (var i=0; i < 100000; i++) { // high enough?
			if (!this.agents[i]) { return i; }
		}
	}

	function Env__killAgent(id) {
		if (!(id in this.agents)) {
			return false;
		}

		var p = this.agents[id].killProgram();
		Promise.when(p, function() {
			var elem = document.getElementById('agent-'+id);
			var dropzone = elem.previousSibling;
			elem.parentNode.removeChild(elem);

			Dropzones.cleanup(dropzone);

			this.router.removeServers(this.agents[id].getUri());
			delete this.agents[id];
		}, this);

		return p;
	}

	function Env__handleAuthChallenge(agent, request, challenge) {
		// :TODO: this should be defined in env code, not core

		var session = agent.getSession(request.uri);
		var p = new Promise();
		switch (challenge.scheme) {
			case 'LSHSession':
				session.authscheme = 'LSHSession';
				if (!session.perms) { session.perms = []; }
				// :TODO: check for perms
				session.perms = session.perms.concat(challenge.perms); // :DEBUG: just give them what they ask
				p.fulfill(true);
				break;
			case 'Basic':
				session.authscheme = 'Basic';
				// :TODO: check for creds
				p.fulfill(false);
				break;
			default:
				throw "unsupported auth scheme '"+challenge.scheme+"'";
		}
		return p;
	}

	// Helpers
	// =======
	// generates HTML for agents to work within
	function Env__makeAgentWrapperElem(id, elem) {
		// create div
		elem = elem || document.createElement('div');
		elem.className = "agent";
		elem.id = "agent-"+id;
		elem.innerHTML = agent_template_html
			.replace(/\{\{id\}\}/g, id)
			.replace(/\{\{uri\}\}/g, 'lsh://'+id+'.ui')
		;
		return elem;
	}
	var agent_template_html =
		//'<div id="agent-{{id}}" class="agent">' +
			'<div class="agent-titlebar">' +
				'<form action="{{uri}}" target="{{id}}">' +
					'<div class="agent-titlebar-ctrls btn-group">' +
						'<button class="btn btn-mini btn-shutter" formmethod="min" title="collapse">_</button>' +
						'<button class="btn btn-mini btn-close" formmethod="close" title="close">&times;</button>' +
					'</div>' +
				'</form>' +
				'<a href="{{uri}}">{{id}}</a>&nbsp;<span class="agent-program"></span>' +
			'</div>' +
			'<div id="agent-{{id}}-body" class="agent-body"></div>'
		//'</div>'
	;

	return Env;
})();
