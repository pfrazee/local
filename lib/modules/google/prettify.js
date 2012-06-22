define(['link', './prettify/prettify'], function() {
    var Module = function() {
        this.instances = {};
        this.uid = 0;
        // add stylesheet
        var style = document.createElement('link');
        style.href = '/modules/google/prettify/prettify.css';
        style.rel = 'stylesheet'; style.media = 'screen';
        document.head.appendChild(style);
        // run prettify
        prettyPrint();
    };

    // Resource Meta
    // =============
    Module.prototype.resources = {
        '/':{
            desc:'Google Prettify. Outputs given text into syntax-highlighted HTML.',
            validate:function(request) {
                if (request.method != 'get' && request.method != 'post') { throw { code:405, reason:"bad method" } };
            },
            _get:'Displays a banner.',
            _post:{
                desc:'Outputs request body in a new div as syntax-highlighted HTML.',
                validate:function(request) {
                    if (!request.body) { throw { code:400, reason:"request body expected" } }
                }
            }
        }
    };
    var InstanceResource = {
        desc:'Active prettyprint instance.',
        _get:'Provides the code without markup.',
        _delete:'Closes down the instance.'
    };
    
    // Route Handlers
    // ==============
    Module.prototype.routes = {
        banner:{ uri:'^/?$', method:'get' },
        prettify:{ uri:'^/?$', method:'post' },
        onget:{ uri:'^/([0-9]+)/?$', method:'get' },
        ondelete:{ uri:'^/([0-9]+)/?$', method:'delete' },
        onrender:{ uri:'^/([0-9]+)/render/?$', method:'post' }
    };
    Module.prototype.banner = function() {
        return { code:200, body:'<h3>Prettify <small>by Google (<a href="http://code.google.com/p/google-code-prettify/" title="google code repo">http://code.google.com/p/google-code-prettify/</a>)</small></h3><p>documentation todo.', 'content-type':'text/html' };
    };
    Module.prototype.prettify = function(request) {
        // New instance
        var instid = this.uid++;
        var inst = this.instances[instid] = {};
        var insturi = '/' + instid;
        this.resources[insturi] = InstanceResource;
        
        // Get the body as a string
        var iface = Link.getTypeInterface(request['content-type'], request.body);
        inst.code = iface.toHtml ? iface.toHtml() : iface.toString();
        inst.type = request['content-type'] || 'text/plain';
        
        // Create UI
        this.mediator.post({
            uri:'#dm',
            title:'prettify',
            body:'<br /><pre class="prettyprint">'+inst.code+'</pre>',
            ctrl_uri:this.uri + insturi
        });
        return { code:204 };
    };
    
    Module.prototype.onget = function(request, match) {
        var instid = match.uri[1];
        var inst = __getInstance.call(this, instid);
        return { code:200, body:inst.code, 'content-type':inst.type };
    };
    Module.prototype.ondelete = function(request, match) {
        var instid = match.uri[1];
        var inst = __getInstance.call(this, instid);
        // remove resource
        delete this.resources['/' + instid];
        // free memory
        delete this.instances[instid];
        return { code:204, reason:'deleted' };
    }            
    Module.prototype.onrender = function() {
        prettyPrint();
    };
    
    // Helpers
    // =======
    var __getInstance = function(id) {
        if (!(id in this.instances)) { throw { code:404, reason:"not found" }; }
        return this.instances[id];
    };

    return Module;
});