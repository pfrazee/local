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
        CLI.init('lshui-cli-input');
        History.init('lshui-hist');

        // Register request handling
        CLI.addListener('request', Env__onRequest, this);
        RequestEvents.addListener('request', Env__onRequest, this);
    }

    function Env__onRequest(request, agent_id, command) {
        // generate command if none is given
        if (!command) {
            command = '';
            if (agent_id) { command += agent_id+'>'; }
            command += request.method;
            command += ' '+request.uri;
            if (request.accept) { command += ' ['+request.accept+']'; }
        }

        // get/create agent
        var agent = Env.getAgent(agent_id);
        if (!agent) { agent = Env.makeAgent(agent_id); }

        // run handler
        agent.onrequest(request, agent.facade);
        // :TODO: addHistory?
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
            onrequest:__defhandle,
            elem:null
        };
        agent.facade = __makeAgentFacade(agent, this.structure);

        // set up DOM
        var wrapper_elem = __makeAgentWrapperElem(id);
        this.container_elem.appendChild(wrapper_elem);

        // set up request event listening
        RequestEvents.observe(wrapper_elem, id);
        agent.elem = document.getElementById('agent-'+id+'-body');

        return (this.agents[id] = agent);
    }
    
    // generates an open id (numeric)
    function __makeAgentId() {
        for (var i=0; i < 100000; i++) { // high enough?
            if (!this.agents[i]) { return i; }
        }
    }

    // creates a new facade object
    function __makeAgentFacade(agent, structure) {
        return {
            getBody:function() { return agent.elem; },
            setRequestHandler:function(handler) { agent.onrequest = handler; },
            defhandle:function(request, agent_facade) { 
                __defhandle(request, agent_facade || agent.facade);
            },
            dispatch:function() { return structure.dispatch.apply(structure, arguments); }
        }
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

    // default request handler
    function __defhandle(request, agent) {
        agent.dispatch(request).then(function(response) {
            if (response.code == 204 || response.code == 205) { return; }
        
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
                    body = Link.encodeType(body, response['content-type']);
                    // escape so that html isnt inserted
                    body = body.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
                }
                agent.getBody().innerHTML = body;
            }

            // run load script 
            if (response['content-type'] == 'application/html+json') {
                agent.setRequestHandler(__defhandle); // new program
                if (response.body._scripts && response.body._scripts.onload) {
                    var fns = response.body._scripts.onload;
                    if (!Array.isArray(fns)) { fns = [fns]; }
                    fns.forEach(function(fn) { Util.execFn(fn, [agent, response]); });
                }
            }
        });
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
