define([
    'link', 
    'notify',
    'env/request-events',
    'env/dropzones',
    'env/html+json'
], function(Link, NotificationCenter, RequestEvents, Dropzones, HtmlJson) {
    var Env = {
        init:Env__init,
        agents:Env__agentFactory,
        killAgent:Env__killAgent,
        AgentConstructor:Agent,
        structure:null, // linkjs uri structure
        container_elem:null, 
        nc:null, // notifications center (plugin to raise alerts)
        is_loaded:new Link.Promise()
    };
    
    // setup
    function Env__init(structure, container_elem_id) {
        // Init attributes
        this.structure = structure;
        this.container_elem = document.getElementById(container_elem_id);
        this.nc = new NotificationCenter();

        Link.setTypeEncoder('application/html+json', HtmlJson.encode);
        Link.setTypeDecoder('application/html+json', HtmlJson.decode);

        RequestEvents.init();
        Dropzones.init();

        document.body.addEventListener('request', Env__onRequestEvent);
        document.body.addEventListener('response', Env__onResponseEvent);
        this.structure.addResponseListener(Env__globalOnResponse, this); // :TODO: remove this whole mechanism

        // send is_loaded signal
        this.is_loaded.fulfill(true);
    }

    function Env__onRequestEvent(e) {
        var request = e.detail.request;

        // figure out the agent
        var agent_id;
        if (!request.target || request.target == '_self') {
            // find parent agent
            var node = e.target;
            while (node) {
                if (node.classList && node.classList.contains('agent')) {
                    agent_id = node;
                    break;
                }
                node = node.parentNode;
            }
        } else if (request.target == '_blank') {
            agent_id = null; // new agent
        } else {
            agent_id = request.target;
        }
        // :TODO: _parent and _top

        var agent = Env.agents(agent_id);
        agent.follow(request, e.target);
    }
    
    function Env__onResponseEvent(e) {
        var request = e.detail.request;
        var response = e.detail.response;
        var agent = Env.agents(request.target, true);
        if (!agent) {
            throw "Agent not found in response event";
        }

        if (response.code == 204 || response.code == 205) { return; }

        var body = response.body;
        if (body) {
            if (response['content-type'] == 'application/html+json') {
                body = HtmlJson.toHtml(body);
            } else {
                // encode to a string
                body = Link.encodeType(body, response['content-type']);
                // escape so that html isnt inserted
                body = body.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            }
            agent.resetBody(); // refreshed state, lose all previous content and listeners
            agent.getBody().innerHTML = body;
        }

        // run load script 
        if (response['content-type'] == 'application/html+json') {
            if (response.body._scripts && response.body._scripts.onload) {
                var fns = response.body._scripts.onload;
                if (!Array.isArray(fns)) { fns = [fns]; }
                fns.forEach(function(fn) { fn(agent, response); });
            }
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

    // agent prototype
    function Agent(id, elem) {
        this.id = id;
        this.elem = elem;
        this.program_server = null;
    }
    Agent.prototype.getBody = function Agent__getBody() { return this.elem; };
    Agent.prototype.getId = function Agent__getId() { return this.id; };
    Agent.prototype.getUri = function Agent__getUri(opt_leading) { return (opt_leading ? '/' : '') + this.id; };
    Agent.prototype.getServer = function Agent__getServer() { return this.program_server; };
    Agent.prototype.attachServer = function Agent__attachServer(s) {
        this.program_server = s;
        Env.structure.removeModules(this.getUri(true));
        if (s) {
            Env.structure.addModule(this.getUri(true), s);
        }
    };
    Agent.prototype.dispatch = function Agent__dispatch() {
        return Env.structure.dispatch.apply(Env.structure, arguments);
    };
    Agent.prototype.follow = function Agent__follow(request, emitter) { 
        request.target = this.id;
        emitter = emitter || this.getBody();
        this.dispatch(request).then(function(response) {
            var re = new CustomEvent('response', { bubbles:true, cancelable:true, detail:{ request:request, response:response }});
            emitter.dispatchEvent(re);
        });
    };
    Agent.prototype.resetBody = function Agent__restBody() {
        var p = this.elem.parentNode;
        var n = document.createElement('div');
        n.id = 'agent-'+this.id+'-body';
        n.className = 'agent-body';
        p.replaceChild(n, this.elem);
        this.elem = n;
    };

    // agent get/create
    // - `id` can be null/undefined to create a new agent with an assigned id
    // - `id` can be the DOM node of the agent; if no agent exists there, it will be created
    function Env__agentFactory(id, opt_nocreate) {
        var given_elem;
        if (id == null || typeof id == 'undefined') {
            if (opt_nocreate) { return null; }
            id = Env__makeAgentId.call(Env);
        } else if (typeof id == 'object') {
            if (id instanceof Node) { // dom element?
                given_elem = id;
                id = (given_elem.id)
                    ? given_elem.id.substr(6) // remove 'agent-'
                    : Env__makeAgentId.call(Env);
            } else {
                return null;
            }
        }
        if (id in Env.agents) {
            return Env.agents[id];
        }

        // get/create element
        var agent_elem = Env__makeAgentWrapperElem(id, given_elem);
        if (!given_elem) {
            // add to dom
            before_elem = Env.container_elem.querySelector('.defcolumn').firstChild;
            before_elem.parentNode.insertBefore(agent_elem, before_elem);
        }
        var body_elem = document.getElementById('agent-'+id+'-body');
        Dropzones.padAgent(agent_elem);

        // drag/drop render-state managers
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

        return (Env.agents[id] = new Agent(id, body_elem));
    }
    
    // generates an open id (numeric)
    function Env__makeAgentId() {
        for (var i=0; i < 100000; i++) { // high enough?
            if (!this.agents[i]) { return i; }
        }
    }

    // agent destroy
    function Env__killAgent(id) {
        if (!(id in this.agents)) {
            return false;
        }
        var elem = document.getElementById('agent-'+id);
        var dropzone = elem.previousSibling;
        elem.parentNode.removeChild(elem);
        Dropzones.cleanup(dropzone);

        this.agents[id].attachServer(null);
        delete this.agents[id];

        return true;
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
                '<form action="{{uri}}">' +
                    '<div class="agent-titlebar-ctrls btn-group">' +
                        '<button class="btn btn-mini" title="move">&there4;</button>' +
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
});
