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
        Link.route('collapseHandler', { uri:'^/([^/]+)/collapse/?$', method:'post' }),
        Link.route('deleteHandler', { uri:'^/([^/]+)/?$', method:'delete' }),
    ];
    SimpleAgentServer.prototype.infoHandler = function(request) {
        if (/html/.match(request.accept)) {
            return Link.response(200, '<h2>Simple <small>Agent Server</small></h2><p>Simple is as simple does.</p>', 'text/html');
        }
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
            //var elem = document.getElementById(agent.domid + '-body');
            //return Link.response(200, elem.innerHTML, 'text/html');
            return Link.response(500); // :TODO:
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
        return; // :TODO: move?
        // update the agent
        agent.is_collapsed = !agent.is_collapsed;
        // update the dom
        var agent_dom = document.getElementById(agent.domid);
        var ci = agent_dom.className.indexOf('collapsed');
        if (agent.is_collapsed && ci == -1) {
            agent_dom.className += ' collapsed';
        } else if (!agent.is_collapsed && ci != -1) {
            agent_dom.className = agent_dom.className.replace(/[\s]*collapsed/i,'');
        }
        var shutter_dom = agent_dom.getElementsByClassName('shutter-btn')[0];
        if (shutter_dom) { shutter_dom.innerText = agent.is_collapsed ? '+' : '_'; }
        // if a ctrl uri was given, notify it
        // :TODO: reconsider
        if (agent.program_uri) {
            this.structure.post({ uri:agent.program_uri + '/collapse' });
        }
        return Link.response(205);
    };
    SimpleAgentServer.prototype.deleteHandler = function(request, match, response) {
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

    // Helpers
    // =======
    var __updateAgentFromRequest = function(index, request) { // :TODO: rename
        // get agent dom
        var agent_domid = this.container_domid + '-agent-' + index;
        var agent_dom = document.getElementById(agent_domid);
        if (!agent_dom) { throw "Unable to find agent dom node"; }

        // make active
        if (/active/.match(agent_dom.className) == false) {
            agent_dom.className += ' active';
        }

        // :TODO: call the agent's response handler

        
        // :TODO: move to def handler
        
    };
    var __closeAgent = function(index) {
        // :TODO: coordinate with env?
        var agent = this.agents[index];
        var elem = agent && document.getElementById(agent.domid);
    }

    return SimpleAgentServer;
});
