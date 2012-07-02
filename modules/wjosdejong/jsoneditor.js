define(['link','./jsoneditoronline/jsoneditor'], function(Link) {
    var Module = function(structure, config) {
        this.structure = structure;
        this.uri = config.uri;
        this.instances = {};
        this.uid = 0;
        // add styling
        var style = document.createElement('link');
        style.href = '/modules/wjosdejong/jsoneditoronline/jsoneditor.css';
        style.rel = 'stylesheet'; style.media = 'screen';
        document.head.appendChild(style);
    };
    
    // Route Handlers
    // ==============
    Module.prototype.routes = [
        Link.route('instantiate', { uri:'^/?$' }),
        Link.route('onget', { uri:'^/([0-9]+)/?$', method:'get' }),
        Link.route('ondelete', { uri:'^/([0-9]+)/?$', method:'delete' }),
        Link.route('onrender', { uri:'^/([0-9]+)/render/?$', method:'post' })
    ];
    Module.prototype.instantiate = function(request) {
        // New instance
        var instid = this.uid++;
        var inst = this.instances[instid] = {};
        
        // Handle data in the request, if a post
        if (request.method == 'post' && request.body) {
            inst.init_data = request.body;
        }

        // Create UI
        this.structure.post({
            uri:'#dm',
            body:'<h3>JSON Editor Online <small>by Jos de Jong (<a href="https://github.com/wjosdejong/jsoneditoronline" title="github repo">https://github.com/wjosdejong/jsoneditoronline</a>)</small></h3><div class="jsoneditor"></div><style>div.jsoneditor-frame { border:none } td.jsoneditor-menu { background:none; border:none }</style>',
            title:'JSON Editor',
            ctrl_uri:this.uri + '/' + instid
        });
        return Link.response(204);
    };
    Module.prototype.onget = function(request, match) {
        var instid = match.uri[1];
        if (!(instid in this.instances)) { return Link.response(404, 0, 0, { reason:"not found" }); }
        var inst = this.instances[instid];
        return Link.response(200, inst.jsoneditor.get(), 'obj');
    };
    Module.prototype.ondelete = function(request, match) {
        var instid = match.uri[1];
        if (!(instid in this.instances)) { return Link.response(404, 0, 0, { reason:"not found" }); }
        var inst = this.instances[instid];
        // free memory
        if (inst.jsoneditor) { delete inst.jsoneditor; }
        delete this.instances[instid];
        return Link.response(204, 0, 0, { reason:'deleted' });
    }            
    Module.prototype.onrender = function(request, match) {
        var div = request.body;
        var instid = match.uri[1];
        if (!(instid in this.instances)) { return Link.response(404, 0, 0, { reason:"not found" }); }
        var inst = this.instances[instid];
        
        // Find the container
        var div_elem = document.getElementById(div.elem_id);
        var container = div_elem.getElementsByClassName('jsoneditor')[0];
        if (!container) { return Link.response(500, 0, 0, { reason:"Unable to find json editor container" }); }
        
        // Create the editor
        inst.jsoneditor = new JSONEditor(container);
        if (inst.init_data) { inst.jsoneditor.set(inst.init_data); }
        
        // Apply some styling changes
        var menu = container.getElementsByClassName('jsoneditor-menu')[0];
        var buttons = menu.getElementsByTagName('button');
        for (var i=0; i < buttons.length; i++) { buttons[i].className = 'btn btn-mini'; }
    };

    return Module;
});
