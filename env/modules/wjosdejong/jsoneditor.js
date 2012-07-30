define(['link', 'lib/html+json', './jsoneditoronline/jsoneditor'], function(Link, HtmlJson) {
    var Server = function(structure, config) {
        this.structure = structure;
        this.uri = config.uri;
        this.instances = {};
        this.uid = 0;
    };
    
    // Route Handlers
    // ==============
    Server.prototype.routes = [
        Link.route('instantiate', { uri:'^/?$' }),
        Link.route('getHandler', { uri:'^/([0-9]+)/?$', method:'get' }),
        Link.route('deleteHandler', { uri:'^/([0-9]+)/?$', method:'delete' }),
    ];
    Server.prototype.instantiate = function(request) {
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
            '<link rel="stylesheet" media="screen" href="/env/modules/wjosdejong/jsoneditoronline/jsoneditor.css" />'
        ]);
        HtmlJson.addScript(body, 'onload', __setupClient, null, inst);
        return Link.response(200, body, 'application/html+json');
    };
    Server.prototype.getHandler = function(request, match) {
        var instid = match.uri[1];
        if (!(instid in this.instances)) { return Link.response(404, 0, 0, { reason:"not found" }); }
        var inst = this.instances[instid];
        return Link.response(200, inst.jsoneditor.get(), 'application/json');
    };
    Server.prototype.deleteHandler = function(request, match) {
        var instid = match.uri[1];
        if (!(instid in this.instances)) { return Link.response(404, 0, 0, { reason:"not found" }); }
        var inst = this.instances[instid];
        // free memory
        if (inst.jsoneditor) { delete inst.jsoneditor; }
        delete this.instances[instid];
        return Link.response(204, 0, 0, { reason:'deleted' });
    }            
    function __setupClient(client, response) {
        // Find the container
        var body_elem = client.getBody();
        var container = body_elem.getElementsByClassName('jsoneditor')[0];
        if (!container) { throw "Unable to find json editor container"; }

        // Create the editor
        client.jsoneditor = new JSONEditor(container);

        // Handle requests
        client.setResponseHandler(function(client, response) {
            if (/application\/json/.test(response['content-type']) && response.body && typeof(response.body) == 'object') {
                client.jsoneditor.set(response.body);
            } else {
                client.setResponseHandler(client.defhandle);
                client.defhandle(response);
            }
        });
    }

    return Server;
});
