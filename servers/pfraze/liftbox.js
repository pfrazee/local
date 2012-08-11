define(['link'], function(Link) {
    // Liftbox Master Server
    // =====================
    // configuration =
    // {
    //   service: { uri:... }
    // }
    var LiftboxMS = function(structure, config) {
        this.structure = structure;
        this.uri = config.uri;
        this.service = config.service;
        this.service.uri_files = this.service.uri + '/files';
    };
    LiftboxMS.prototype.routes = [
        Link.route('serveAgent', { uri:'^/?$', method:'get', accept:/application\/html\+json/i }),
        Link.route('serveFile', { uri:'(.*)', method:'get', accept:'application/json' })
    ];
    LiftboxMS.prototype.serveAgent = function() {
        var body = {
            _scripts:{ onload:setupLiftboxAgent },
            _data:{ service:this.service }
        }; 
        return Link.response(200, body, 'application/html+json');
    };

    // Liftbox Agent Server
    // ====================
    var LiftboxAS = function(agent) {
        this.agent = agent;
    };
    LiftboxAS.prototype.routes = [
        Link.route('servUpdir', { uri:'^/\.\./?' }),
        Link.route('servItem', { uri:'^/([0-9]+)/?' })
    ];
    LiftboxAS.prototype.servUpdir = function(request) {
        // calc from curpath (up one dir)
        var parts = this.agent.curpath.split('/');
        parts.pop();
        var path = parts.join('/');
        if (!path) { path = '/'; }
        // pipe to service
        request = Object.create(request);
        request.uri = this.agent.service.uri_files + path;
        return this.agent.dispatch(request);
    };
    LiftboxAS.prototype.servItem = function(request, match) {
        // grab file
        var file = this.agent.files[+match.uri[1] - 1];
        if (!file) { return { code:404 }; }
        // Pipe to service
        request = Object.create(request);
        request.uri = this.agent.service.uri_files + file.path;
        return this.agent.dispatch(request);
    };

    // Agent Client
    // ============
    function setupLiftboxAgent(agent, response) {
        try { 
            // grab params
            agent.service = response.body._data.service;
        } catch(e) { throw "malformed response body"; }

        // setup agent
        agent.files = [];
        agent.curpath = '/';
        agent.attachServer(new LiftboxAS(agent));

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
            uri:agent.service.uri_files,
            accept:'application/json'
        });
    }
    function renderDir(agent) {
        var html = '';
        var body = agent.getBody();

        html += '<div class="pfraze-liftbox">';

        // files
        html += '<p><a href="'+agent.getUri()+'/..">..</a></p>';
        html += '<table class="table table-striped">';
        agent.files.forEach(function(f, i) {
            var date = new Date(f.modified);
            date = (date.getMonth()+1)+'/'+date.getDate()+'&nbsp;'+date.getHours()+':'+(date.getMinutes() < 10 ? '0' : '')+date.getMinutes();
            html += '<tr><td width="20">'+(i+1)+'</td><td><a href="'+agent.service.uri_files+f.path+'" type="application/json">'+f.path+'</a></td></tr>';
        });
        html += '</table>';

        // add to DOM
        body.innerHTML = html;
    }
    function renderFile(agent, file) {
        var html = '';
        var body = agent.getBody();

        html += '<div class="pfraze-liftbox">';

        // output data
        html += '<p><a href="'+agent.getUri()+'/..">..</a></p>';
        file.data = file.data.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>\n").replace(/ /g, "&nbsp;").replace(/\t/g, "&nbsp;&nbsp;&nbsp;&nbsp;");
        html += file.data;

        // add to DOM
        body.innerHTML = html;
    }

    return LiftboxMS;
});
