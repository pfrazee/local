define(['./jsoneditoronline/jsoneditor'], function() {
    var Module = function() {
        this.instances = {};
        this.uid = 0;
        // add styling
        var style = document.createElement('link');
        style.href = '/modules/wjosdejong/jsoneditoronline/jsoneditor.css';
        style.rel = 'stylesheet'; style.media = 'screen';
        document.head.appendChild(style);
    };

    // Resource Meta
    // =============
    Module.prototype.resources = {
        '/':{
            desc:'Jos de Jong\'s JSON Editor.',
            asserts:function(request) {
                if (request.method != 'get' && request.method != 'post') { throw { code:405, reason:"bad method" } };
            },
            _get:'Creates a new instance of the editor.',
            _post:{
                desc:'Creates a new instance of the editor using the given data.',
                asserts:function(request) {
                    if (!request.body) { throw { code:400, reason:"request body expected" } }
                }
            }
        }
    };
    var InstanceResource = {
        desc:'Active JSON Editor instance.',
        _get:'Provides the data in the instance.',
    };
    var InstanceRenderResource = {
        desc:'Instructs the instance a chance to set up its DOM controls (called by the div manager).',
        _post:{
            validates:function(request) {
                if (!request.body) { throw { code:400, reason:"request body required" } }
                if (!request.body.elem_id) { throw { code:400, reason:"target element id required" } }
            }
        }
    };
    
    // Route Handlers
    // ==============
    Module.prototype.routes = [
        { cb:'instantiate', uri:'^/?$' },
        { cb:'onget', uri:'^/([0-9]+)/?$', method:'get' },
        { cb:'onrender', uri:'^/([0-9]+)/render/?$', method:'post' }
    ];
    Module.prototype.instantiate = function(request) {
        // New instance
        var instid = this.uid++;
        var inst = this.instances[instid] = {};
        var insturi = '/' + instid;
        this.resources[insturi] = InstanceResource;
        this.resources[insturi + '/render'] = InstanceRenderResource;
        
        // Handle data in the request, if a post
        if (request.method == 'post' && request.body) {
            inst.init_data = Link.getTypeInterface(request['content-type'], request.body).toObject();
        }

        // Create UI
        this.mediator.post({
            uri:'#dm',
            body:'<h3>JSON Editor Online <small>by Jos de Jong (<a href="https://github.com/wjosdejong/jsoneditoronline" title="github repo">https://github.com/wjosdejong/jsoneditoronline</a>)</small></h3><div class="jsoneditor"></div><style>div.jsoneditor-frame { border:none } td.jsoneditor-menu { background:none; border:none }</style>',
            ctrl_uri:this.uri + insturi
        });
        return { code:200, body:'new json editor opened' };
    };
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