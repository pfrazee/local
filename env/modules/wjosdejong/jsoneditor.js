define(['link', 'lib/html+json', './jsoneditoronline/jsoneditor'], function(Link, HtmlJson) {
    var Module = function(structure, config) {
        this.structure = structure;
        this.uri = config.uri;
        this.instances = {};
        this.uid = 0;
    };
    
    // Route Handlers
    // ==============
    Module.prototype.routes = [
        Link.route('instantiate', { uri:'^/?$' }),
        Link.route('getHandler', { uri:'^/([0-9]+)/?$', method:'get' }),
        Link.route('deleteHandler', { uri:'^/([0-9]+)/?$', method:'delete' }),
    ];
    Module.prototype.instantiate = function(request) {
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
        HtmlJson.addScript(body, 'onrender', __onrender, null, inst);

        // Add to UI
        this.structure.post({
            uri:'#dm',
            body:body,
            'content-type':'application/html+json',
            title:'JSON Editor',
            ctrl_uri:this.uri + '/' + instid
        });
        return Link.response(204);
    };
    Module.prototype.getHandler = function(request, match) {
        var instid = match.uri[1];
        if (!(instid in this.instances)) { return Link.response(404, 0, 0, { reason:"not found" }); }
        var inst = this.instances[instid];
        return Link.response(200, inst.jsoneditor.get(), 'application/json');
    };
    Module.prototype.deleteHandler = function(request, match) {
        var instid = match.uri[1];
        if (!(instid in this.instances)) { return Link.response(404, 0, 0, { reason:"not found" }); }
        var inst = this.instances[instid];
        // free memory
        if (inst.jsoneditor) { delete inst.jsoneditor; }
        delete this.instances[instid];
        return Link.response(204, 0, 0, { reason:'deleted' });
    }            
    function __onrender(elem, env, inst) {
        // Find the container
        var container = elem.getElementsByClassName('jsoneditor')[0];
        if (!container) { throw "Unable to find json editor container"; }

        // Create the editor
        inst.jsoneditor = new JSONEditor(container);
        if (inst.init_data) { inst.jsoneditor.set(inst.init_data); }
    }

    return Module;
});
