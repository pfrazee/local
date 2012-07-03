define(['link', './prettify/prettify'], function(Link) {
    var Module = function(structure, config) {
        this.structure = structure;
        this.uri = config.uri;
        this.instances = {};
        this.uid = 0;
        // add stylesheet
        var style = document.createElement('link');
        style.href = '/env/modules/google/prettify/prettify.css';
        style.rel = 'stylesheet'; style.media = 'screen';
        document.head.appendChild(style);
        // run prettify
        prettyPrint();
    };
    
    // Route Handlers
    // ==============
    Module.prototype.routes = [
        Link.route('banner', { uri:'^/?$', method:'get' }),
        Link.route('prettify', { uri:'^/?$', method:'post' }),
        Link.route('onget', { uri:'^/([0-9]+)/?$', method:'get' }),
        Link.route('ondelete', { uri:'^/([0-9]+)/?$', method:'delete' })
    ];
    Module.prototype.banner = function() {
        return { code:200, body:'<h3>Prettify <small>by Google (<a href="http://code.google.com/p/google-code-prettify/" title="google code repo">http://code.google.com/p/google-code-prettify/</a>)</small></h3><p>documentation todo.', 'content-type':'text/html' };
    };
    Module.prototype.prettify = function(request, match, structure) {
        // New instance
        var instid = this.uid++;
        var inst = this.instances[instid] = {};
        var insturi = '/' + instid;
        
        // Get the contents
        inst.code = request.body ? request.body.toString() : '';
        inst.type = request['content-type'] || 'text/plain';
        
        // Create UI
        this.structure.post({
            uri:'#dm',
            title:'prettify',
            body:'<br /><pre class="prettyprint">'+inst.code+'</pre>',
            ctrl_uri:this.uri + insturi,
            onrender:prettyPrint
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
        // free memory
        delete this.instances[instid];
        return { code:204, reason:'deleted' };
    }            
    
    // Helpers
    // =======
    var __getInstance = function(id) {
        if (!(id in this.instances)) { throw { code:404, reason:"not found" }; }
        return this.instances[id];
    };

    return Module;
});
