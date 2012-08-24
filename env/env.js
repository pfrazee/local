define([
    'link', 
    'notify',
    'env/request-events',
    'env/html+json'
], function(Link, NotificationCenter, RequestEvents, HtmlJson) {
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
        RequestEvents.addListener('request', Env__onRequestEvent, this);
        this.structure.addResponseListener(Env__onResponse, this);

        // :TODO: move the dropzone stuff into another library
        document.body.addEventListener('drop', function(evt) {
            if (!evt.target.classList.contains('dropzone') && !evt.target.classList.contains('dropcolumn')) {
                return;
            }
            evt.stopPropagation && evt.stopPropagation(); // no default behavior (redirects)

            try {
                var link = JSON.parse(evt.dataTransfer.getData('application/link+json'));
            } catch (except) {
                console.log('Bad data provided on RequestEvents drop handler', except, evt);
            }

            // create an agent now, so we can specify where it is made
            var target = evt.target;
            if (target.classList.contains('dropcolumn')) {
                if (target.hasChildNodes() == false) {
                    // we need a dropzone to act as the target
                    target = document.createElement('div');
                    target.classList.add('dropzone');
                    evt.target.appendChild(target);
                    // also, will need drop-columns around you
                    var dc1 = document.createElement('td');
                    dc1.classList.add('dropcolumn');
                    evt.target.parentNode.insertBefore(dc1, evt.target);
                    var dc2 = document.createElement('td');
                    dc2.classList.add('dropcolumn');
                    evt.target.parentNode.insertBefore(dc2, evt.target.nextSibling);
                } else {
                    target = evt.target.lastChild;
                }
            }
            var agent = Env.agents(undefined, false, target);
            link.target = agent.getId();

            Env__onRequestEvent(link);
            return false;
        }, false);
        document.body.addEventListener('dragover', function(e) {
            e.preventDefault && e.preventDefault(); // dont cancel the drop
            e.dataTransfer.dropEffect = 'link';
            if (e.target.classList.contains('dropzone') || e.target.classList.contains('dropcolumn')) {
                e.target.classList.add('request-hover');
            }
            return false;
        }, false);
        document.body.addEventListener('dragleave', function(e) {
            Array.prototype.forEach.call(document.querySelectorAll('.dropcolumn, .dropzone'), function(dropzone) {
                dropzone.classList.remove('request-hover');
            });
        }, false);
        document.body.addEventListener('dragend', function(e) {
            Array.prototype.forEach.call(document.querySelectorAll('.dropcolumn, .dropzone'), function(dropzone) {
                dropzone.classList.remove('request-hover');
            });
        }, false);

        // send is_loaded signal
        this.is_loaded.fulfill(true);
    }

    function Env__onRequestEvent(request) {
        var agent = Env.agents(request.target);
        agent.onrequest(request, agent);
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
        this.program_server = null;
    }
    Agent.prototype.getBody = function Agent__getBody() { return this.elem; };
    Agent.prototype.setRequestHandler = function Agent__setRequestHandler(handler) { this.onrequest = handler; };
    Agent.prototype.getId = function Agent__getId() { return this.id; };
    Agent.prototype.getUri = function Agent__getUri(opt_leading) { return (opt_leading ? '/' : '') + this.id; };
    Agent.prototype.getServer = function Agent__getServer() { return this.program_server; };
    Agent.prototype.defhandleRequest = function Agent__defhandleRequest(request) {
        __defhandleRequest(request, this);
    };
    Agent.prototype.defhandleResponse = function Agent__defhandleResponse(response) {
        __defhandleResponse(response, this);
    };
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
    Agent.prototype.follow = function Agent__follow(request) { 
        request.target = this.id;
        return Env__onRequestEvent.call(Env, request);
    };

    // agent get/create
    function Env__agentFactory(id, opt_nocreate, opt_before_elem) {
        id = (id !== null && typeof id != 'undefined') ? id : Env__makeAgentId.call(Env);
        if (id in Env.agents) {
            return Env.agents[id];
        } else if (opt_nocreate) {
            return null;
        }

        // add to DOM
        var wrapper_elem = Env__makeAgentWrapperElem(id);
        opt_before_elem = opt_before_elem || Env.container_elem.querySelector('.defcolumn').firstChild;
        opt_before_elem.parentNode.insertBefore(wrapper_elem, opt_before_elem);
        var body_elem = document.getElementById('agent-'+id+'-body');
        RequestEvents.observe(wrapper_elem, id);

        // pad with dropzones as needed
        // :NOTE: dont get fancy yet -- this approach may not work
        var pad = function(sibling) {
            var attr = sibling + 'Sibling';
            if (!wrapper_elem[attr] || !wrapper_elem[attr].classList.contains('dropzone')) {
                var elem = document.createElement('div');
                elem.className = "dropzone";
                wrapper_elem.parentNode.insertBefore(elem, (sibling == 'next') ? wrapper_elem.nextSibling : wrapper_elem);
            }
        };
        pad('prev');
        pad('next');

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
        var column = wrapper_elem.parentNode;
        column.removeChild(wrapper_elem.nextSibling); // remove dropzone
        column.removeChild(wrapper_elem);
        if (column.children.length == 1) { // just one item (dropzone) left?
            column.parentNode.removeChild(column.nextSibling); // remove trailing dropcolumn
            column.parentNode.removeChild(column); // remove trailing dropcolumn
        }

        this.agents[id].attachServer(null);
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
        // create div
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
