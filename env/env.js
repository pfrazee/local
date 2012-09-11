var Env = (function() {
    // Env
    // ===
    // corrals the agents and HTTP traffic
    var Env = {
        init:Env__init,
        getAgent:Env__getAgent,
        makeAgent:Env__makeAgent,
        killAgent:Env__killAgent,

        io:null, // httprouter instance 
        agents:{},
        container_elem:null, 
        nc:null, // notifications center (plugin to raise alerts)
        is_loaded:new Promise()
    };
    
    // setup
    function Env__init(io, container_elem_id) {
        this.io = io;
        this.container_elem = document.getElementById(container_elem_id);
        this.nc = new notificationCenter();

        RequestEvents.init();
        Dropzones.init();

        document.body.addEventListener('request', Env__onRequestEvent);
        document.body.addEventListener('response', Env__onResponseEvent);
        this.io.addResponseListener(Env__globalOnResponse, this); // :TODO: remove this whole mechanism

        // send is_loaded signal
        this.is_loaded.fulfill(true);
    }

    function Env__onRequestEvent(e) {
        var request = e.detail.request;

        // figure out the agent
        var agent_id;
        switch (request.target) {
            case false:
            case '_self':
                // find parent agent
                var node = e.target;
                while (node) {
                    if (node.classList && node.classList.contains('agent')) {
                        agent_id = node;
                        break;
                    }
                    node = node.parentNode;
                }
                break;
            case '_parent':
                // :TODO: ?
            case '_blank':
                agent_id = null; // new agent
                break;
            default:
                agent_id = request.target;
        }

        var agent = Env.getAgent(agent_id) || Env.makeAgent(agent_id);
        agent.follow(request, e.target);
    }
    
    function Env__onResponseEvent(e) {
        var request = e.detail.request;
        var response = e.detail.response;
        var agent = Env.getAgent(request.target);
        if (!agent)
            throw "Agent not found in response event";
        
        if (response.code == 204 || response.code == 205) { return; }

        var body = response.body;
        if (body) {
            // encode to a string
            body = ContentTypes.serialize(body, response['content-type']);
            // escape so that html isnt inserted :TODO: should it?
            // body = body.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            agent.resetBody(); // refreshed state, lose all previous content and listeners
            agent.getBody().innerHTML = body;
        }
    }

    function Env__globalOnResponse(response) {
        // notify user of any errors
        if (response.code >= 400) {
            var request = response.org_request;
            var msg = '';
            msg += '<strong>'+response.code+' '+(response.reason ? response.reason : '')+'</strong><br />';
            msg += request.method+' '+request.uri+' ['+request.accept+']';
            this.nc.notify({ html:msg, autoClose:4000 });
        }
    }

    // agent get
    // - `id` can be the id or DOM node of the agent
    function Env__getAgent(id) {
        if (typeof id == 'object' && id instanceof Node) { 
            var given_elem = id;
            id = (given_elem.id)
                ? given_elem.id.substr(6) // remove 'agent-'
                : null;
        }
        if (id in Env.agents) {
            return Env.agents[id];
        }
        return null;
    }

    // agent create
    // - `id` can be null/undefined to create a new agent with an assigned id
    function Env__makeAgent(id, opt_target_elem) {
        if (id == null || typeof id == 'undefined') {
            id = Env__makeAgentId.call(Env);
        }
        if (id in this.agents) {
            return this.agents[id];
        }

        // add container elem to dom
        var agent_elem = Env__makeAgentWrapperElem(id, opt_target_elem);
        if (!opt_target_elem) {
            var before_elem = this.container_elem.querySelector('.defcolumn').firstChild;
            before_elem.parentNode.insertBefore(agent_elem, before_elem);
        }
        var body_elem = document.getElementById('agent-'+id+'-body');
        Dropzones.padAgent(agent_elem);

        // drag/drop render-state managers
        // :TODO: put in the agent constructor or member function?
        agent_elem.addEventListener('dragenter', function(e) {
            agent_elem.classList.add('request-hover');
        });
        agent_elem.addEventListener('dragleave', function(e) {
            // dragleave is fired on all children, so only pay attention if it dragleaves our region
            var rect = agent_elem.getBoundingClientRect();
            if (e.x >= (rect.left + rect.width) || e.x <= rect.left
             || e.y >= (rect.top + rect.height) || e.y <= rect.top) {
                agent_elem.classList.remove('request-hover');
            }
        });
        agent_elem.addEventListener('drop', function(e) {
            agent_elem.classList.remove('request-hover');
        });

        // create agent
        var agent = new Agent(id, body_elem);
        this.io.addServer('/'+id, agent);

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

            delete this.agents[id];
            this.io.removeServers('/'+id)
        }, this);

        return p;
    }

    // Agent prototype
    // ===============
    function Agent(id, elem) {
        this.id = id;
        this.elem = elem;
        this.worker = null;
        this.program_load_promise = null;
        this.program_kill_promise = null;
        this.program_kill_timeout = null;
        this.pending_requests = [];
    }
    Agent.prototype.routes = [
        HttpRouter.route('collapseHandler', { uri:'^/?$', method:/min|max/i }),
        HttpRouter.route('closeHandler', { uri:'^/?$', method:'close' }),
        HttpRouter.route('programRequestHandler', { uri:'(.*)' })
    ];
    Agent.prototype.getBody = function Agent__getBody() { return this.elem; };
    Agent.prototype.getId = function Agent__getId() { return this.id; };
    Agent.prototype.getUri = function Agent__getUri(opt_leading) { return (opt_leading ? '/' : '') + this.id; };
    Agent.prototype.dispatch = function Agent__dispatch(request) {
        return Env.io.dispatch(request);
    };
    Agent.prototype.follow = function Agent__follow(request, emitter) { 
        request.target = this.id;
        emitter = emitter || this.getBody();
        request.accept = request.accept || 'text/html';
        Env.io.dispatch(request).then(function(response) {
            var re = new CustomEvent('response', { bubbles:true, cancelable:true, detail:{ request:request, response:response }});
            emitter.dispatchEvent(re);
        });
    };
    Agent.prototype.resetBody = function Agent__resetBody() {
        var p = this.elem.parentNode;
        var n = document.createElement('div');
        n.id = 'agent-'+this.id+'-body';
        n.className = 'agent-body';
        p.replaceChild(n, this.elem);
        this.elem = n;
    };
    Agent.prototype.loadProgram = function Agent__loadProgram(url, config) {
        var self = this;
        self.program_load_promise = new Promise();

        Promise.when(self.killProgram(), function() {
            self.worker = new Worker('/env/agent-worker.js');

            // event 'foo' runs 'onWorkerFoo'
            self.worker.addEventListener('message', function(message) {
                var evtHandler = 'onWorker' + ucfirst(message.data.event).replace(/:/g, '_');
                if (evtHandler in self) {
                    self[evtHandler].call(self, message.data);
                }
            });

            config = config ? Util.deepCopy(config) : {};
            config.program_url = url;
            config.agent_id = self.getId();
            config.agent_uri = self.getUri(true);
            self.postWorkerEvent('setup', { config:config });
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

        // dont let load listeners run, this program is foobared
        if (this.program_load_promise) {
            this.program_load_promise = null;
        }

        if (opt_force_terminate) {
            clearTimeout(this.program_kill_timeout);
            this.program_kill_timeout = null;

            this.worker.terminate();
            this.worker = null;

            this.program_kill_promise.fulfill(true);
            this.program_kill_promise = null;
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
        this.loadProgram(e.url);
    };
    Agent.prototype.onWorkerLog = function Agent__onWorkerLog(e) {
        console.log(this.id+':', e.msg);
    };
    Agent.prototype.onWorkerHttp_request = function Agent__onWorkerHttp_request(e) {
        var fn = (e.follow) ? this.follow : this.dispatch;
        fn.call(this, e.request).then(function(response) {
            this.postWorkerEvent('http:response', { mid:e.mid, response:response })
        }, this);
    };
    Agent.prototype.onWorkerHttp_response = function Agent__onWorkerHttp_response(e) {
        var response = e.response;
        var pending_request = this.pending_requests[e.mid];
        if (!pending_request) { throw "Response received from agent worker with bad message id"; }
        // if !pendingRequest, make sure that the response wasnt accidentally sent twice
        this.pending_requests[e.mid] = null;
        pending_request.fulfill(response);
    };
    Agent.prototype.collapseHandler = function Agent__collapseHandler(request) {
        var should_collapse = (request.method == 'min');
        var is_collapsed = this.elem.parentNode.classList.contains('collapsed');

        if (is_collapsed != should_collapse) {
            this.elem.parentNode.classList.toggle('collapsed');
        }

        var shutter_btn = document.querySelector('.btn-shutter', this.elem);
        if (shutter_btn) { 
            shutter_btn.innerText = should_collapse ? '+' : '_';
            shutter_btn.setAttribute('formmethod', should_collapse ? "max" : "min");
        }

        return HttpRouter.response(205);
    };
    Agent.prototype.closeHandler = function Agent__closeHandler() {
        Env.killAgent(this.id);
        return HttpRouter.response(205);
    };
    Agent.prototype.programRequestHandler = function Agent__programRequestHandler(request, match) {
        if (!this.worker) { return; }

        var p = new Promise;
        var mid = this.pending_requests.length;
        this.pending_requests.push(p);

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
        
    // generates HTML for agents to work within
    function Env__makeAgentWrapperElem(id, elem) {
        // create div
        elem = elem || document.createElement('div');
        elem.className = "agent";
        elem.id = "agent-"+id;
        elem.innerHTML = agent_template_html
            .replace(/{{id}}/g, id)
            .replace(/{{uri}}/g, '/'+id)
        ;
        return elem;
    }
    var agent_template_html = 
        //'<div id="agent-{{id}}" class="agent">' +
            '<div class="agent-titlebar">' +
                '<form action="{{uri}}" target="{{id}}">' +
                    '<div class="agent-titlebar-ctrls btn-group">' +
                        '<button class="btn btn-mini btn-shutter" formmethod="min" title="collapse">_</button>' +
                        '<button class="btn btn-mini" formmethod="close" title="close">&times;</button>' +
                    '</div>' +
                '</form>' +
                '<a href="{{uri}}">{{id}}</a>' +
            '</div>' +
            '<div id="agent-{{id}}-body" class="agent-body"></div>'
        //'</div>'
    ;

    return Env;
})();