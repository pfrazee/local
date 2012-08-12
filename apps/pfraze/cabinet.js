define(['link'], function(Link) {
    // Cabinet Master Server
    // =====================
    // delivers a GUI for navigating and viewing a files service
    // configuration =
    // {
    //   service: { uri:... }
    // }
    var CabinetMS = function(structure, config) {
        this.structure = structure;
        this.uri = config.uri;
        this.service = config.service;
    };
    CabinetMS.prototype.routes = [
        Link.route('serveAgent', { uri:'^/?$', method:'get', accept:/application\/html\+json/i })
    ];
    CabinetMS.prototype.serveAgent = function() {
        var body = {
            _scripts:{ onload:setupCabinetAgent },
            _data:{ service:this.service }
        }; 
        return Link.response(200, body, 'application/html+json');
    };

    // Cabinet Agent Server
    // ====================
    var CabinetAS = function(agent) {
        this.agent = agent;
    };
    CabinetAS.prototype.routes = [
        Link.route('servUpdir', { uri:/^\/\.\.\/?/i }),
        Link.route('servNum', { uri:'^/([0-9]+)/?' }),
        Link.route('servName', { uri:'^/(.+)/?' })
    ];
    CabinetAS.prototype.servUpdir = function(request, match) {
        // calc from curpath (up one dir)
        var parts = this.agent.curpath.split('/');
        parts.pop();
        var path = parts.join('/');
        if (!path) { path = ''; }
        // pipe to service
        request = Object.create(request);
        request.uri = this.agent.service.uri + path;
        return this.agent.dispatch(request);
    };
    CabinetAS.prototype.servNum = function(request, match) {
        // grab file
        var file = this.agent.files[+match.uri[1] - 1];
        if (!file) { return { code:404 }; }
        // pipe to service
        request = Object.create(request);
        request.uri = this.agent.service.uri + file.path;
        return this.agent.dispatch(request);
    };
    CabinetAS.prototype.servName = function(request, match, response) {
        if (response && response.code) { return response; }
        // pipe to service
        request = Object.create(request);
        request.uri = this.agent.service.uri + '/' + match.uri[1];
        return this.agent.dispatch(request);
    };

    // Agent Client
    // ============
    function setupCabinetAgent(agent, response) {
        try { 
            // grab params
            agent.service = response.body._data.service;
        } catch(e) { throw "malformed response body"; }

        // setup agent
        agent.files = [];
        agent.curpath = '/';
        agent.attachServer(new CabinetAS(agent));

        // set up request handler to navigate directories
        agent.setRequestHandler(function(req) {
            if (req.uri.indexOf(agent.service.uri) == 0 || req.uri.indexOf(agent.getUri()) == 0) {
                agent.dispatch(req).then(function(res) {
                    if (res.code == 200 && res['content-type'] == 'application/json') {
                        agent.curpath = res.body.path;
                        if (res.body.is_dir) {
                            agent.files = res.body.contents;
                            renderDir(agent);
                            return;
                        } else {
                            renderFile(agent, res.body);
                        }
                    }
                });
            } else {
                // Drop program
                agent.defhandleRequest(req);
            }
        });

        // get root
        agent.follow({
            method:'get',
            uri:agent.service.uri,
            accept:'application/json'
        });
    }
    function renderDir(agent) {
        var html = '';
        var body = agent.getBody();

        html += '<div class="pfraze-cabinet">';

        // files
        html += '<p><a href="'+agent.getUri()+'/..">..</a></p>';
        html += '<table class="table table-striped">';
        agent.files.forEach(function(f, i) {
            var date = new Date(f.modified);
            date = (date.getMonth()+1)+'/'+date.getDate()+'&nbsp;'+date.getHours()+':'+(date.getMinutes() < 10 ? '0' : '')+date.getMinutes();
            html += '<tr><td width="20">'+(i+1)+'</td><td><a href="'+agent.service.uri+f.path+'" type="application/json">'+f.path+'</a></td></tr>';
        });
        html += '</table>';

        // add to DOM
        body.innerHTML = html;
    }
    function renderFile(agent, file) {
        var html = '';
        var body = agent.getBody();

        html += '<div class="pfraze-cabinet">';

        // output data
        html += '<p><a href="'+agent.getUri()+'/..">..</a></p>';
        file.data = file.data.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>\n").replace(/ /g, "&nbsp;").replace(/\t/g, "&nbsp;&nbsp;&nbsp;&nbsp;");
        html += file.data;

        // add to DOM
        body.innerHTML = html;
    }

    return CabinetMS;
});
