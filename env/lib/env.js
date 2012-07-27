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
            agent.onresponse.call(agent, response);
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
            }).then(agent.onresponse, agent);
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
        id = id || Env__makeAgentId.call(this);
        if (id in this.agents) {
            return false;
        }
        var agent = {
            id:id,
            onresponse:Env__handleResponse,
            elem:null
        };
        // set up DOM
        var wrapper_html = Env__makeAgentWrapperHtml(id);
        this.container_elem.innerHTML += wrapper_html;
        // set up request event listening
        var wrapper_elem = document.getElementById('agent-'+id);
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
        // :TODO: call an agent destroy func?
        delete this.agents[id];
        return true;
    }

    // default response handler
    function Env__handleResponse(response) {
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
            this.elem.innerHTML = body;
        }

        // run load script 
        if (response['content-type'] == 'application/html+json') {
            if (body._scripts && body._scripts.onload) {
                var fns = response.body._scripts.onload;
                if (!Array.isArray(fns)) { fns = [fns]; }
                fns.forEach(function(fn) { Util.execFn(fn, [response], this); });
            }
        }
    }

    // generates an open id (numeric)
    function Env__makeAgentId() {
        for (var i=0; i < 100000; i++) { // high enough?
            if (!this.agents[i]) { return i; }
        }
    }

    // generates HTML for agents to work within
    function Env__makeAgentWrapperHtml(id) {

        return agent_template_html
            .replace(/{{id}}/g, id)
            .replace(/{{uri}}/g, '/a/'+id)
        ;
    }
    var agent_template_html = 
        '<div id="agent-{{id}}" class="agent">' +
            '<div class="agent-titlebar">' +
                '<form action="{{uri}}">' +
                    '<div class="agent-titlebar-ctrls btn-group">' +
                        '<button class="btn btn-mini btn-shutter" formmethod="post" formaction="{{uri}}/collapse" title="collapse">_</button>' +
                        '<button class="btn btn-mini" formmethod="delete" title="close">&times;</button>' +
                    '</div>' +
                '</form>' +
                '<a href="{{uri}}">{{uri}}</a>' +
            '</div>' +
            '<div id="agent-{{id}}-body" class="agent-body"></div>' +
        '</div>'
    ;

    return Env;
});
