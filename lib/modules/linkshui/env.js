define(['linkshui/inc/env', 'link'], function(IncEnv) {
    
    var Module = function(config) {
        this.config = config;
    };

    // Resource Meta
    // =============
    Module.prototype.resources = {
        'GET':'Lists the resources in the environment.'
    };

    // Route Handlers
    // ==============
    Module.prototype.routes = {
        list:{ uri:"^/?$" }
    };
    Module.prototype.list = function(request, match, structure) {
        var promise = new Link.Promise();
        var requests = [];
        // request link structures from each module
        for (var i=0; i < env_config.structure.length; i++) {
            var module = env_config.structure[i];
            var req = structure.dispatch(
                { method:'get', uri:module.uri, accept:'js/lshui.env+object' },
                null, null, [resourcesDec]
            );
            requests.push(req);
        }
        Link.Promise.whenAll(requests, function(responses) {
            // combine into one structure
            var resources = {};
            for (var i=0; i < responses.length; i++) {
                if (responses[i].code >= 400) { continue; }
                var uri = env_config.structure[i].uri;
                resources[uri] = responses[i].body;
            }
            // add self
            //resources[this.config.uri] = this.resources;
            promise.fulfill({ code:200, body:resources, 'content-type':'js/lshui.env+object' });
        }, this);
        return promise;
    };

    // Type interfaces
    // ===============
    Link.addToType('js/lshui.env+object', {
        toHtml:function() {
            return __toHtml(this.data, '#');
        }
    });
    // renders the resource tree
    var __toHtml = function(node, baseuri) {
        var html = [];
        // add members
        for (var uri in node) {
            html.push('<li>');
            var realuri = baseuri;
            if (uri.charAt(0) == '#') {
                realuri = uri;
            } else if (uri.charAt(0) == '/') {
                realuri = baseuri + uri;
            }
            html.push('<a href="'+realuri+'">'+uri+'</a>');   
            if (typeof(node[uri]) == 'object') {
                html.push('<ul>');
                html.push(__toHtml(node[uri], realuri));
                html.push('</ul>');
            } else {
                html.push(': '+node[uri]);
            }
            html.push('</li>');
        }
        return html.join('');
    };

    var resourcesDec = function _resourcesDec(handler, request, match, structure) {
        if (request.accept == 'js/lshui.env+object') {
            return { code:200, body:this.resources, 'content-type':request.accept };
        } else {
            return handler();
        }
    };

    return Module;
});