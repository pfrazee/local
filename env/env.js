define(['link', 'notify', 'env/request-events', 'env/cli', 'env/html+json'], function(Link, NotificationCenter, RequestEvents, CLI, HtmlJson) {
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
        CLI.init();

        RequestEvents.addListener('request', Env__onRequestEvent, this);
        CLI.addListener('request', Env__onRequestEvent, this);
        this.structure.addResponseListener(Env__onResponse, this);

        // send is_loaded signal
        this.is_loaded.fulfill(true);
    }

    function Env__onRequestEvent(request, agent_id) {
        // get/create agent
        var agent = Env.agents(agent_id);

        // run handler
        agent.onrequest(request, agent);
        // :TODO: addHistory?
    }

    function Env__onResponse(response) {
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
        this.onrequest = __defhandleRequest;
    }
    Agent.prototype.getBody = function Agent__getBody() { return this.elem; };
    Agent.prototype.setRequestHandler = function Agent__setRequestHandler(handler) { this.onrequest = handler; };
    Agent.prototype.getId = function Agent__getId() { return this.id; };
    Agent.prototype.getUri = function Agent__getUri() { return this.id; };
    Agent.prototype.defhandleRequest = function Agent__defhandleRequest(request) {
        __defhandleRequest(request, this);
    };
    Agent.prototype.defhandleResponse = function Agent__defhandleResponse(response) {
        __defhandleResponse(response, this);
    };
    Agent.prototype.dispatch = function Agent__dispatch() {
        return Env.structure.dispatch.apply(Env.structure, arguments);
    };
    Agent.prototype.follow = function Agent__follow(request) { 
        return Env__onRequestEvent.call(Env, request, this.id);
    };

    // agent get/create
    function Env__agentFactory(id, opt_nocreate) {
        id = id || Env__makeAgentId.call(Env);
        if (id in Env.agents) {
            return Env.agents[id];
        } else if (opt_nocreate) {
            return null;
        }

        // add to DOM
        var wrapper_elem = Env__makeAgentWrapperElem(id);
        Env.container_elem.insertBefore(wrapper_elem, Env.container_elem.firstChild);
        var body_elem = document.getElementById('agent-'+id+'-body');
        RequestEvents.observe(wrapper_elem, id);

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
        var wrapper_elem = document.getElementById('agent-'+id);
        wrapper_elem.parentNode.removeChild(wrapper_elem);
        // :TODO: call program die func?
        delete this.agents[id];
        return true;
    }

    // default request handler
    function __defhandleRequest(request, agent) {
        agent.dispatch(request).then(agent.defhandleResponse, agent);    
    }
    function __defhandleResponse(response, agent) {
        if (response.code == 204 || response.code == 205) { return; }
        // update dom 
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
            agent.getBody().innerHTML = body;
            agent.setRequestHandler(__defhandleRequest); // state changed, reset handler
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

    // generates HTML for agents to work within
    function Env__makeAgentWrapperElem(id) {
        var elem = document.createElement('div');
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
