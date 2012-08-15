define(['link', 'env/html+json', './jsoneditoronline/jsoneditor'], function(Link, HtmlJson) {
    // JSON Editor Online
    // an editor for examining and manipulating object data
    // master server
    function JeoMS(structure, config) {
        this.structure = structure;
        this.uri = config.uri;
        this.instances = {};
        this.uid = 0;
    };
    JeoMS.prototype.routes = [
        Link.route('instantiate', { uri:'^/?$' }),
        Link.route('getHandler', { uri:'^/([0-9]+)/?$', method:'get' }),
        Link.route('deleteHandler', { uri:'^/([0-9]+)/?$', method:'delete' }),
    ];
    JeoMS.prototype.instantiate = function(request) {
        // New instance
        var instid = this.uid++;
        var inst = this.instances[instid] = {};
        
        // Handle data in the request, if a post
        if (request.method == 'post' && request.body) {
            inst.init_data = request.body;
        }
        
        // Create html
        var body = HtmlJson.mknode(0,0,0,[
            '<h3>JSON Editor Online <small>by Jos de Jong (<a href="https://github.com/wjosdejong/jsoneditoronline" title="github repo">https://github.com/wjosdejong/jsoneditoronline</a>)</small></h3><div class="jsoneditor"></div>',
            '<link rel="stylesheet" media="screen" href="/modules/wjosdejong/jsoneditoronline/jsoneditor.css" />'
        ]);
        HtmlJson.addScript(body, 'onload', Jeo__setupAgent);
        return Link.response(200, body, 'application/html+json');
    };
    JeoMS.prototype.getHandler = function(request, match) {
        var instid = match.uri[1];
        if (!(instid in this.instances)) { return Link.response(404, 0, 0, { reason:"not found" }); }
        var inst = this.instances[instid];
        return Link.response(200, inst.jsoneditor.get(), 'application/json');
    };
    JeoMS.prototype.deleteHandler = function(request, match) {
        var instid = match.uri[1];
        if (!(instid in this.instances)) { return Link.response(404, 0, 0, { reason:"not found" }); }
        var inst = this.instances[instid];
        // free memory
        if (inst.jsoneditor) { delete inst.jsoneditor; }
        delete this.instances[instid];
        return Link.response(204, 0, 0, { reason:'deleted' });
    };

    // agent server
    function JeoAS(agent) {
        this.agent = agent;
    }
    JeoAS.prototype.routes = [
        Link.route('getData', { method:'get', uri:'^/?$' })
    ];
    JeoAS.prototype.getData = function() {
        return Link.response(200, this.agent.jsoneditor.get(), 'application/json');
    };

    // client program
    function Jeo__setupAgent(agent, response) {
        // Find the container
        var body_elem = agent.getBody();
        var container = body_elem.getElementsByClassName('jsoneditor')[0];
        if (!container) { throw "Unable to find json editor container"; }

        // Create the editor
        agent.jsoneditor = new JSONEditor(container);

        // Instantiate server
        agent.attachServer(new JeoAS(agent));

        // Handle requests
        agent.setRequestHandler(function(request) {
            agent.dispatch(request).then(function(response) {
                agent.jsoneditor.set(response.body);
            });
        });
    }

    return JeoMS;
});
