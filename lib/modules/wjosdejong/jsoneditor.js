define(['link','./jsoneditoronline/jsoneditor'], function() {
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
            validate:function(request) {
                if (request.method != 'get' && request.method != 'post') { throw { code:405, reason:"bad method" } };
            },
            _get:'Creates a new instance of the editor.',
            _post:{
                desc:'Creates a new instance of the editor using the given data.',
                validate:function(request) {
                    if (!request.body) { throw { code:400, reason:"request body expected" } }
                }
            }
        }
    };
    var InstanceResource = {
        desc:'Active JSON Editor instance.',
        _get:'Provides the data in the instance.',
        _delete:'Closes down the instance.'
    };
    
    // Route Handlers
    // ==============
    Module.prototype.routes = [
        { cb:'instantiate', uri:'^/?$' },
        { cb:'onget', uri:'^/([0-9]+)/?$', method:'get' },
        { cb:'ondelete', uri:'^/([0-9]+)/?$', method:'delete' },
        { cb:'onrender', uri:'^/([0-9]+)/render/?$', method:'post' }
    ];
    Module.prototype.instantiate = function(request) {
        // New instance
        var instid = this.uid++;
        var inst = this.instances[instid] = {};
        var insturi = '/' + instid;
        this.resources[insturi] = InstanceResource;
        
        // Handle data in the request, if a post
        if (request.method == 'post' && request.body) {
            var iface = Link.getTypeInterface(request['content-type'], request.body);
            inst.init_data = (iface && iface.toObject) ? iface.toObject() : request.body;
        }

        // Create UI
        this.mediator.post({
            uri:'#dm',
            body:'<h3>JSON Editor Online <small>by Jos de Jong (<a href="https://github.com/wjosdejong/jsoneditoronline" title="github repo">https://github.com/wjosdejong/jsoneditoronline</a>)</small></h3><div class="jsoneditor"></div><style>div.jsoneditor-frame { border:none } td.jsoneditor-menu { background:none; border:none }</style>',
            title:'JSON Editor',
            ctrl_uri:this.uri + insturi
        });
        return { code:204 };
    };
    Module.prototype.onget = function(request, response, match) {
        var instid = match.uri[1];
        var inst = __getInstance.call(this, instid);
        return { code:200, body:inst.jsoneditor.get(), 'content-type':'js/object' };
    };
    Module.prototype.ondelete = function(request, response, match) {
        var instid = match.uri[1];
        var inst = __getInstance.call(this, instid);
        // remove resource
        delete this.resources['/' + instid];
        // free memory
        if (inst.jsoneditor) { delete inst.jsoneditor; }
        delete this.instances[instid];
        return { code:204, reason:'deleted' };
    }            
    Module.prototype.onrender = function(request, response, match) {
        var div = request.body;
        var instid = match.uri[1];
        var inst = __getInstance.call(this, instid);
        
        // Find the container
        var div_elem = document.getElementById(div.elem_id);
        var container = div_elem.getElementsByClassName('jsoneditor')[0];
        if (!container) { throw { code:500, reason:"Unable to find json editor container" }; }
        
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
        if (!(id in this.instances)) { throw { code:404, reason:"not found" }; }
        return this.instances[id];
    };

    return Module;
});