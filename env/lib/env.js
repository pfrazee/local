define(['link', 'lib/request-events', 'lib/cli', 'lib/history', 'lib/html+json', 'lib/util'], function(Link, RequestEvents, CLI, History, HtmlJson, Util) {
    var Env = {
        init:Env__init,
        getAgent:Env__getAgent,
        makeAgent:Env__makeAgent,
        killAgent:Env__killAgent
    };
    
    // setup
    function Env__init(structure, container_elem_id) {
        // Init attributes
        this.structure = structure;
        this.agents = {};
        this.container_elem = document.getElementById(container_elem_id);

        // Add type en/decoders
        Link.setTypeEncoder('application/html+json', HtmlJson.encode);
        Link.setTypeDecoder('application/html+json', HtmlJson.decode);

        // Init libs
        //LinkRegistry.init(env_config.links); :TODO: reconsider
        RequestEvents.init();
        CLI.init(structure, 'lshui-cli-input');
        History.init('lshui-hist');

        // Register request handling
        CLI.addListener('response', function(response, agent_id) {
            // get/create agent
            var agent = Env.getAgent(agent_id);
            if (!agent) { agent = Env.makeAgent(agent_id); }

            // run handler
            agent.onresponse(agent.facade, response);
        });
        RequestEvents.addListener('request', function(request, agent_id) { 
            // get/create agent
            var agent = Env.getAgent(agent_id);
            if (!agent) { agent = Env.makeAgent(agent_id); }

            // add handler and dispatch
            structure.dispatch(request, function(response) {
                // add to history
                var cmd = '';
                if (agent_id) { cmd += agent_id+'>'; }
                cmd += request.method;
                cmd += ' '+request.uri;
                if (request.accept) { cmd += ' ['+request.accept+']'; }
                History.addEntry(cmd, response);

                // run handler
                agent.onresponse(agent.facade, response);
            });
        });
    }

    // agent get
    function Env__getAgent(id) {
        if (id in this.agents) {
            return this.agents[id];
        }
    }

    // agent create
    function Env__makeAgent(id) {
        // create agent object
        id = id || __makeAgentId.call(this);
        if (id in this.agents) {
            return false;
        }
        var agent = {
            id:id,
            onresponse:__handleResponse,
            elem:null
        };
        // Create facade
        agent.facade = __makeAgentFacade(agent);
        // set up DOM
        var wrapper_elem = __makeAgentWrapperElem(id);
        this.container_elem.appendChild(wrapper_elem);
        // set up request event listening
        RequestEvents.observe(wrapper_elem, id);
        agent.elem = document.getElementById('agent-'+id+'-body');
        // all set
        return (this.agents[id] = agent);
    }
    
    // agent destroy
    function Env__killAgent(id) {
        if (!id || !(id in this.agents)) {
            return false;
        }
        // remove DOM
        var wrapper_elem = document.getElementById('agent-'+id);
        wrapper_elem.parentNode.removeChild(wrapper_elem);
        // :TODO: call an agent destroy func?
        delete this.agents[id];
        return true;
    }

    // default response handler
    function __handleResponse(agent, response) {
        // Do nothing if no content
        if (response.code == 204 || response.code == 205) { return; }
            
        // If a redirect, do that now
        // :TODO:
        /*if (response.code >= 300 && response.code < 400) {
            followRequest({ method:'get', uri:response.location, accept:'text/html' });
            return;
        }*/

        // Update link registry
        // :TODO: reconsider
        //LinkRegistry.update(response.link);

        // update dom 
        var body = response.body;
        if (body) {
            if (response['content-type'] == 'application/html+json') {
                body = HtmlJson.toHtml(body);
            } else {
                // encode to a string
                body = Link.encodeType(body, request['content-type']);
                // escape so that html isnt inserted
                body = body.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            }
            agent.getBody().innerHTML = body;
        }

        // run load script 
        if (response['content-type'] == 'application/html+json') {
            if (response.body._scripts && response.body._scripts.onload) {
                var fns = response.body._scripts.onload;
                if (!Array.isArray(fns)) { fns = [fns]; }
                fns.forEach(function(fn) { Util.execFn(fn, [agent, response]); });
            }
        }
    }

    // generates an open id (numeric)
    function __makeAgentId() {
        for (var i=0; i < 100000; i++) { // high enough?
            if (!this.agents[i]) { return i; }
        }
    }

    // creates a new facade object
    function __makeAgentFacade(agent) {
        return {
            getBody:function() { return agent.elem; },
            setResponseHandler:function(handler) { agent.onresponse = handler; },
            defhandle:function(agent_facade, response) { 
                // agent_facade is optional
                if (typeof response == 'undefined') {
                    response = agent_facade;
                    agent_facade = agent.facade;
                }
                __handleResponse(agent_facade, response);
            }
        }
    }

    // generates HTML for agents to work within
    function __makeAgentWrapperElem(id) {
        var elem = document.createElement('div');
        elem.className = "agent";
        elem.id = "agent-"+id;
        elem.innerHTML = agent_template_html
            .replace(/{{id}}/g, id)
            .replace(/{{uri}}/g, '/a/'+id)
        ;
        return elem;
    }
    var agent_template_html = 
        //'<div id="agent-{{id}}" class="agent">' +
            '<div class="agent-titlebar">' +
                '<form action="{{uri}}">' +
                    '<div class="agent-titlebar-ctrls btn-group">' +
                        '<button class="btn btn-mini btn-shutter" formmethod="post" formaction="{{uri}}/collapse" title="collapse">_</button>' +
                        '<button class="btn btn-mini" formmethod="delete" title="close">&times;</button>' +
                    '</div>' +
                '</form>' +
                '<a href="{{uri}}">{{uri}}</a>' +
            '</div>' +
            '<div id="agent-{{id}}-body" class="agent-body"></div>'
        //'</div>'
    ;

    return Env;
});
