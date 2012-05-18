define(['./jsoneditoronline/jsoneditor'], function() {
    var Module = function() {
        this.instances = {};
        this.uid = 0;
        // :TODO: set this up to handle multiple editors at once
        Link.addStylesheet('/modules/wjosdejong/jsoneditoronline/jsoneditor.css');
    };

    Module.prototype.routes = [
        { cb:'instantiate', uri:'^/?$' },
        { cb:'onget', uri:'^/([0-9]+)/?$', method:'get' },
        { cb:'onrender', uri:'^/([0-9]+)/render/?$', method:'post' }
    ];

    // main()
    // ======
    Module.prototype.instantiate = function(request) {
        // New instance
        var instid = this.uid++;
        var inst = this.instances[instid] = {};
        
        // Handle data in the request, if a post
        if (request.method == 'post' && request.body) {
            inst.init_data = Link.getTypeInterface(request['content-type'], request.body).toObject();
        }

        // Create UI
        this.mediator.post({
            uri:'#dm',
            body:'<h3>JSON Editor Online <small>by Jos de Jong (<a href="https://github.com/wjosdejong/jsoneditoronline" title="github repo">https://github.com/wjosdejong/jsoneditoronline</a>)</small></h3><div class="jsoneditor"></div><style>div.jsoneditor-frame { border:none } td.jsoneditor-menu { background:none; border:none }</style>',
            ctrl_uri:this.uri + '/' + instid
        });
        return { code:200 };
    };

    // Instance handlers
    // =================
    Module.prototype.onget = function(request, response, match) {
        var instid = match.uri[1];
        var inst = __getInstance.call(this, instid);
        return { code:200, body:inst.jsoneditor.get(), 'content-type':'js/object' };
    };
    Module.prototype.onrender = function(request, response, match) {
        var div = request.body;
        var instid = match.uri[1];
        var inst = __getInstance.call(this, instid);
        
        // Find the container
        var div_elem = document.getElementById(div.elem_id);
        var container = div_elem.getElementsByClassName('jsoneditor')[0];
        if (!container) { throw "Unable to find json editor container"; }
        
        // Create the editor
        inst.jsoneditor = new JSONEditor(container);
        if (inst.init_data) { inst.jsoneditor.set(inst.init_data); }
        
        // Apply some styling changes
        var menu = container.getElementsByClassName('jsoneditor-menu')[0];
        var buttons = menu.getElementsByTagName('button');
        for (var i=0; i < buttons.length; i++) { buttons[i].className = 'btn btn-mini'; }
    };

    // Helpers
    // =======
    var __getInstance = function(id) {
        if (!(id in this.instances)) { throw "Invalid id given to json editor"; }
        return this.instances[id];
    };

    return Module;
});