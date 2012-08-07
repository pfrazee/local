define(['link'], function(Link) {
    // Runbox Master Server
    // ====================
    // delivers a program for quick code eval()
    // configuration =
    // {
    // }
    var RunboxMS = function(structure, config) {
        this.structure = structure;
        this.uri = config.uri;
    };
    RunboxMS.prototype.routes = [
        Link.route('serve', { uri:'^/?$', method:'get', accept:/application\/html\+json/i })
    ];
    RunboxMS.prototype.serve = function() {
        var body = {
            _scripts:{ onload:setupRunboxAgent }
        }; 
        return Link.response(200, body, 'application/html+json');
    };

    // Runbox Agent Server
    // ===================
    var RunboxAS = function(agent, code_elem) {
        this.agent = agent;
        this.code_elem = code_elem;
    };
    RunboxAS.prototype.routes = [
        Link.route('runCode', { uri:'(.*)', })
    ];
    // Resources
    RunboxAS.prototype.runCode = function(request) {
        var code = this.code_elem.value;
        eval('var fn = function(agent) { '+code+' }');
        if (fn) {
            var res = fn(this.agent, request, new Link.Promise());
            if (res) { return res; }
            return { code:200 };
        }
        return { code:400 };
    };

    // Agent Client
    // ============
    function setupRunboxAgent(agent, response) {
        // add html
        var html = '';
        html += '<form action="'+agent.getUri()+'" method="run">';
        html += '<button class="btn">run '+agent.getUri()+'</button><br />';
        html += '</form>';
        html += '<textarea class="codebox span8" rows="15"></textarea>';
        agent.getBody().innerHTML = html;

        // start agent server
        var code_elem = agent.getBody().getElementsByClassName('codebox')[0];
        agent.attachServer(new RunboxAS(agent, code_elem));
    }

    return RunboxMS;
});
