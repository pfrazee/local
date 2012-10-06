var Agent = (function() {
	// Agent prototype
	// ===============
	function Agent(id, elem) {
		this.id = id;
		this.elem_agent = elem;
		this.elem_body = elem.querySelector('.agent-body');

		this.worker = null;
		this.program_config = null;
		this.program_counter = 1; // used to track when programs have changed

		this.sessions = {}; // a hash of domain -> Session

		// used by http:request/http:response to track work in progress
		this.in_requests_to_process = []; // (an array of promises)

		this.dom_event_handlers = {}; // a hash of events->handler obj array

		this.program_load_promise = null;
		this.program_kill_promise = null;
		this.program_kill_timeout = null;
	}
	Agent.prototype.getContainer = function Agent__getContainer() { return this.elem_agent; };
	Agent.prototype.getBody = function Agent__getBody() { return this.elem_body; };
	Agent.prototype.getId = function Agent__getId() { return this.id; };
	Agent.prototype.getUri = function Agent__getUri() { return 'lsh://' + this.id + '.ui'; };
	Agent.prototype.getProgramUri = function Agent__getProgramUri() { return (this.program_config) ? this.program_config.program_uri : null; };

	Agent.prototype.emitDomRequestEvent = function Agent__emitDomRequestEvent(request) {
		Promise.when(this.program_load_promise, function() {
			var re = new CustomEvent('request', { bubbles:true, cancelable:true, detail:{ request:request }});
			this.getBody().dispatchEvent(re);
		}, this);
	};
	Agent.prototype.dispatch = function Agent__dispatch(request, conn_perms) {
		request.org = this.getId();
		request.accept = request.accept || 'text/html';
		request.authorization = this.getSessionAuth(request, conn_perms);

		var response_promise = new Promise();
		var org_program_counter = this.program_counter;
		Env.router.dispatch(request).then(function(response) {
			if (org_program_counter != this.program_counter) {
				return; // we must have changed programs since this was dispatched
			}

			if (response.code == 401) {
				// 401 means we need auth info/permissions from the user
				var challenges = response['www-authenticate'];
				var handleEnvResult = function(success) {
					if (success) {
						// try again with the updated session
						request.authorization = this.getSessionAuth(request, conn_perms);
						Env.router.dispatch(request).then(response_promise.fulfill, response_promise);
					} else {
						response.code = 403; // upgrade to a 'never-gunna-happen'
						response_promise.fulfill(response);
					}
				};
				Env.handleAuthChallenge(this, request, challenges).then(handleEnvResult, this);
			} else {
				response_promise.fulfill(response);
			}
		}, this);
		return response_promise;
	};

	Agent.prototype.resetBody = function Agent__resetBody() {
		var n = document.createElement('div');
		n.id = this.elem_body.id;
		n.className = 'agent-body';
		this.elem_agent.replaceChild(n, this.elem_body);
		this.elem_body = n;
		this.dom_event_handlers.length = 0;
	};

	Agent.prototype.getSession = function Agent__getSession(uri) {
		var uri_desc = Http.parseUri(uri);
		var session = this.sessions[uri_desc.host];
		if (!session) {
			session = this.sessions[uri_desc.host] = Sessions.make(this);
		}
		return session;
	};
	Agent.prototype.getProgramSession = function Agent__getProgramSession() {
		return this.getSession(this.getUri());
	};
	Agent.prototype.getSessionAuth = function Agent__getSessionAuth(request, conn_perms) {
		var auth = this.getSession(request.uri).getAuth();
		/* :TODO: if (conn_perms) {
			if (!Array.isArray(conn_perms)) { conn_perms = [conn_perms]; }
			sess.perms = sess.perms.concat(conn_perms);
		}*/
		return auth;
	};

	// Dom Events
	// ==========
	function countMatches(m) { return (m ? m.length : 0); }
	function getEventNodes(selector) {
		return selector ?
			this.getBody().querySelectorAll(selector) :
			[this.getBody()];
	}
	Agent.prototype.addDomEventHandler = function Agent__addDomEventHandler(event, selector) {
		if (!this.getContainer()) { throw "Agent DOM required"; }
		
		var nodes = getEventNodes.call(this, selector);

		// make the handler
		var handler = {
			handleEvent:Agent.genericDomEventHandler,
			agent:this,
			selector:selector
		};
		this.dom_event_handlers[event + ' ' + selector] = handler;
		// :TODO: the dom_event_handlers will not know to remove handlers if the element is removed -- memory leak?

		Array.prototype.forEach.call(nodes, function(el) {
			el.addEventListener(event, handler);
		});
	};
	Agent.prototype.removeDomEventHandler = function Agent__removeDomEventHandler(event, selector) {
		if (!this.getContainer()) { throw "Agent DOM required"; }
		
		var nodes = getEventNodes.call(this, selector);

		// lose track of the handler
		var hid = event + ' ' + selector;
		var handler = this.dom_event_handlers[hid];
		this.dom_event_handlers[hid] = null;

		Array.prototype.forEach.call(nodes, function(el) {
			el.removeEventListener(event, handler);
		});
	};
	Agent.prototype.getDomEventHandler = function Agent__getDomEventHandler(event, selector) {
		return this.dom_event_handlers[event + ' ' + selector];
	};
	Agent.genericDomEventHandler = function Agent__genericDomEventHandler(e) {
		var workerEvent = 'dom:'+e.type;
		if (this.selector) { workerEvent += ' '+this.selector; }

		// give the worker all the data we can copy
		var workerEventData = {};
		for (var k in e) {
			if ((/boolean|number|string/).test(typeof e[k]) || k == 'detail') {
				workerEventData[k] = e[k];
			}
		}

		// find the index of the node in the selector
		var nodes = getEventNodes.call(this.agent, this.selector);
		for (var i=0; i < nodes.length; i++) {
			if (e.target == nodes[i]) {
				workerEventData.target_index = i;
				break;
			}
		}

		if (e.type == 'request') {
			var request = workerEventData.detail.request;
			if (!request.authorization) {
				request.authorization = this.agent.getSessionAuth(request, ['connection']);
			}
		}

		this.agent.postWorkerEvent(workerEvent, workerEventData);
		e.stopPropagation();
	};

	// Worker Program Management
	// =========================
	Agent.prototype.loadProgram = function Agent__loadProgram(uri, config) {
		var self = this;
		self.program_load_promise = new Promise();

		// :TODO: permissions check

		Promise.when(self.killProgram(), function() {
			self.worker = new Worker('/env/agent-worker.js');

			// :NOTE: event 'foo:bar' runs function 'onWorkerFoo_bar'
			self.worker.addEventListener('message', function(message) {
				var evtHandler = 'onWorker' + ucfirst(message.data.event).replace(/:/g, '_');
				if (evtHandler in self) {
					self[evtHandler].call(self, message.data);
				}
			});

			self.program_config             = config ? Util.deepCopy(config) : {};
			self.program_config.program_uri = uri;
			self.program_config.agent_id    = self.getId();
			self.program_config.agent_uri   = self.getUri();
			self.postWorkerEvent('setup', { config:self.program_config });

			// update agent header
			var header_el = self.getContainer().querySelector('.agent-program');
			header_el.innerHTML = uri; header_el.title = uri;
		});
		return self.program_load_promise;
	};
	Agent.prototype.killProgram = function Agent__killProgram(opt_force_terminate) {
		if (!this.worker) { return true; }
		if (this.program_kill_promise) {
			if (!opt_force_terminate) { return this.program_kill_promise; }
		} else {
			this.program_kill_promise = new Promise();
		}

		if (opt_force_terminate) {
			clearTimeout(this.program_kill_timeout);
			this.program_kill_timeout = null;

			this.worker.terminate();
			this.worker = null;
			this.program_config = null;
			this.program_counter++;

			this.sessions = {};

			this.program_kill_promise.fulfill(true);
			this.program_kill_promise = null;

			this.in_requests_to_process.forEach(function(p) {
				p.fulfill({ code:'500', reason:'service closed' });
			});
		} else {
			// if not forcing termination, send the worker a kill event and give it 10 seconds to send back a 'dead' event
			this.postWorkerEvent('kill');

			var self = this;
			this.program_kill_timeout = setTimeout(function() {
				// :TODO: prompt user to force terminate?
				self.killProgram(true);
			}, 1000); // 1 second
		}
		return this.program_kill_promise;
	};
	Agent.prototype.hasProgram = function Agent__hasProgram() { return !!this.program_config; };
	Agent.prototype.getProgramConfig = function Agent__getProgramConfig() {
		return this.program_config;
	};

	// Worker Event Handlers
	// =====================
	Agent.prototype.postWorkerEvent = function Agent__postWorkerEvent(evt_name, data) {
		if (!this.worker) { return; } // :TODO: throw? log?
		data = data ? Util.deepCopy(data) : {};
		data.event = evt_name;
		this.worker.postMessage(data);
	};
	Agent.prototype.onWorkerReady = function Agent__onWorkerReady(e) {
		if (this.program_load_promise) {
			this.program_load_promise.fulfill(e);
			this.program_load_promise = null;
		}
	};
	Agent.prototype.onWorkerDead = function Agent__onWorkerDead() {
		this.killProgram(true);
	};
	Agent.prototype.onWorkerYield = function Agent__onWorkerYield(e) {
		// 'yield' event means the worker wants to load a new program
		// :TODO: check permissions and issue 'noyield' if not allowed
		this.loadProgram(e.uri);
	};
	Agent.prototype.onWorkerLog = function Agent__onWorkerLog(e) {
		console.log(this.id+':', e);
	};
	Agent.prototype.onWorkerHttp_request = function Agent__onWorkerHttp_request(e) {
		// worker has made an http request
		this.dispatch(e.request).then(function(response) {
			this.postWorkerEvent('http:response', { mid:e.mid, response:response });
		}, this);
	};
	Agent.prototype.onWorkerHttp_response = function Agent__onWorkerHttp_response(e) {
		// worker has responded to a request
		var response = e.response;
		var pending_request = this.in_requests_to_process[e.mid];
		if (!pending_request) { throw "Response received from agent worker with bad message id"; }
		this.in_requests_to_process[e.mid] = null;
		pending_request.fulfill(response);
	};

	// HTTP Request Handlers
	Agent.prototype.routes = [
		Http.route('collapseHandler', { uri:'^/?$', method:/min|max/i }),
		Http.route('closeHandler', { uri:'^/?$', method:'close' }),
		Http.route('programRequestHandler', { uri:'^/app(/.*)' })
	];
	Agent.prototype.collapseHandler = function Agent__collapseHandler(request) {
		var should_collapse = (request.method == 'min');
		var is_collapsed = this.getContainer().classList.contains('collapsed');

		if (is_collapsed != should_collapse) {
			this.getContainer().classList.toggle('collapsed');
		}

		var shutter_btn = this.getContainer().querySelector('.btn-shutter');
		if (shutter_btn) {
			shutter_btn.innerText = should_collapse ? '+' : '_';
			shutter_btn.setAttribute('formmethod', should_collapse ? "max" : "min");
		}

		return Http.response(205);
	};
	Agent.prototype.closeHandler = function Agent__closeHandler() {
		Env.killAgent(this.id);
		return Http.response(205);
	};
	Agent.prototype.programRequestHandler = function Agent__programRequestHandler(request, match) {
		if (!this.worker) { return; }

		var auth = request.authorization;
		if (!auth || auth.perms.indexOf('connection') == -1) {
			return Http.response.badperms(['connection'], 'application access');
		}

		var p = new Promise();
		var mid = this.in_requests_to_process.length;
		this.in_requests_to_process.push(p);

		var dup_req = Util.deepCopy(request);
		dup_req.uri = match.uri[1];

		this.postWorkerEvent('http:request', { mid:mid, request:dup_req });

		return p;
	};

	// Helpers
	// =======
	// fooBar -> Foobar
	function ucfirst(str) {
		return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
	}

	return Agent;
})();
