define(['link', 'env/env', 'env/util', 'env/html+json'], function(Link, Env, Util, HtmlJson) {
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
        //Link.route('createHandler', { uri:'^/?$', method:'post' }),
        Link.route('getHandler', { uri:'^/([^/]+)/?$', method:'get' }, true),
        Link.route('collapseHandler', { uri:'^/([^/]+)/?$', method:/min|max/i }),
        Link.route('closeHandler', { uri:'^/([^/]+)/?$', method:'close' })
    ];
    // :TODO: requires consideration
    /*SimpleAgentServer.prototype.createHandler = function(request, match, response) {
        agent = Env.makeAgent();
        if (!agent) { return { code:500, reason:'unable to create new agent' }; }
        // :TODO: fill with request body
        return Link.response(205);
    };*/
    SimpleAgentServer.prototype.getHandler = function(request, match, response) {
        // only handle as a fallback
        if (response && response.code != 0) { return response; }

        // get obj
        var id = match.uri[1];
        var agent = Env.getAgent(id);
        if (!agent) { return { code:404, reason:'agent not found' }; }
        
        // just give the contents of the agent
        return Link.response(200, agent.elem.innerHTML, 'text/html');
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
        return Link.response(205);
    };
    SimpleAgentServer.prototype.closeHandler = function(request, match, response) {
        var id = match.uri[1];
        var success = Env.killAgent(id);
        if (!success) { return { code:404, reason:'not found' }; }
        return Link.response(205);
    };
    
    return SimpleAgentServer;
});
