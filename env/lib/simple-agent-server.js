define(['link', 'lib/env', 'lib/util', 'lib/html+json'], function(Link, Env, Util, HtmlJson) {
    // Simple Agent Server
    // ===================
    // provides http access to the document's agents
    var SimpleAgentServer = function(structure, config) {
        this.uri = config.uri;
        this.agents = {};
        this.structure = structure;
    };
    
    // Route Handlers
    // ==============
    SimpleAgentServer.prototype.routes = [
        Link.route('infoHandler', { uri:'^/?$', method:'get' }),
        Link.route('createHandler', { uri:'^/?$', method:'post' }),
        Link.route('getHandler', { uri:'^/([^/]+)/?$', method:'get' }),
        Link.route('setHandler', { uri:'^/([^/]+)/?$', method:'put' }),
        Link.route('collapseHandler', { uri:'^/([^/]+)/?$', method:/min|max/i }),
        Link.route('closeHandler', { uri:'^/([^/]+)/?$', method:'close' })
    ];
    SimpleAgentServer.prototype.infoHandler = function(request) {
        // :TODO: add summary of active agents
        if (/html/.test(request.accept)) {
            var html = '<h2>Simple <small>Agent Server</small></h2><p>Simple is as simple does.</p>';
            var type = 'text/html';
            if (/application\/html\+json/.test(request.accept)) {
                html = { childNodes:[html] };
                type = 'application/html+json';
            }
            return Link.response(200, html, type);
        }
        return { code:415 };
    };
    SimpleAgentServer.prototype.createHandler = function(request, match, response) {
        agent = Env.makeAgent();
        if (!agent) { return { code:500, reason:'unable to create new agent' }; }
        // :TODO: fill with request body
        return Link.response(205);
    };
    SimpleAgentServer.prototype.getHandler = function(request, match, response) {
        // get obj
        var id = match.uri[1];
        var agent = Env.getAgent(id);
        if (!agent) { return { code:404, reason:'agent not found' }; }
        // if a ctrl uri was given, use that
        // :TODO: reconsider
        if (false /*agent.program_uri*/) {
            var promise = new Link.Promise();
            this.structure.get({ uri:agent.program_uri, accept:request.accept }, function(response) {
                promise.fulfill(response);
            });
            return promise;
        } else {
            // no uri, just give the contents of the agent
            var data = agent.elem.innerHTML;
            if (/application\/html\+json/.test(request.accept)) {
                return Link.response(200, { childNodes:[data] }, 'application/html+json');
            }
            if (/json/.test(request.accept)) {
                return Link.response(200, { data:data }, 'application/json');
            }
            return Link.response(200, agent.elem.innerHTML, 'text/html');
        }
    };
    SimpleAgentServer.prototype.setHandler = function(request, match, response) {
        // replace
        var id = match.uri[1];
        Env.killAgent(id);
        Env.makeAgent(id);
        // :TODO: fill with request body
        return Link.response(200);
    };
    SimpleAgentServer.prototype.collapseHandler = function(request, match, response) {
        // validate
        var id = match.uri[1];
        var agent = Env.getAgent(id);
        if (!agent) { return { code:404, reason:'agent not found' }; }
        var agent_elem = document.getElementById('agent-'+id);
        if (!agent_elem) { return { code:500, reason:'unable to find agent elem' }; }
        // update the agent dom
        var should_collapse = (request.method == 'min'); // if max, uncollapse
        var is_collapsed = /collapsed/.test(agent_elem.className);
        if (!is_collapsed && should_collapse) {
            agent_elem.className += ' collapsed';
        } else if (is_collapsed && !should_collapse) {
            agent_elem.className = agent_elem.className.replace(/[\s]*collapsed/i,'');
        }
        var shutter_elem = agent_elem.getElementsByClassName('btn-shutter')[0];
        if (shutter_elem) { 
            shutter_elem.innerText = should_collapse ? '+' : '_';
            shutter_elem.setAttribute('formmethod', should_collapse ? "max" : "min");
        }
        // if a ctrl uri was given, notify it
        // :TODO: reconsider
        /*if (agent.program_uri) {
            this.structure.post({ uri:agent.program_uri + '/collapse' });
        }*/
        return Link.response(205);
    };
    SimpleAgentServer.prototype.closeHandler = function(request, match, response) {
        var id = match.uri[1];
        var success = Env.killAgent(id);
        if (!success) { return { code:404, reason:'not found' }; }
        // notify the control
        // :TODO: reconsider
        /*var agent = this.agents[index];
        if (agent.program_uri) {
            this.structure.dispatch({ method:'delete', uri:agent.program_uri });
        }*/
        return Link.response(205);
    };
    
    return SimpleAgentServer;
});
