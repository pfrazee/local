define(['link'], function() {
    var Module = function() {
    };

    // Resource Meta
    // =============
    Module.prototype.resources = {
        '/': {
            desc:'Lists the resources in the environment.',
        }
    };

    // Route Handlers
    // ==============
    Module.prototype.routes = [
        { cb:"list", uri:"^/?$" }
    ];
    Module.prototype.list = function() {
        var resources = this.mediator.findResources('.*', 0);
        // organize the resources into a tree based on URI depth
        var rtree = {};
        for (var uri in resources) {
            var uri_parts = uri.split('/');
            var node = { children:rtree };
            // create all the nodes we need
            for (var i=0; i < uri_parts.length; i++) {
                var part = uri_parts[i];
                if (!node.uri) { node.uri = uri_parts.splice(0,i).join('/'); }
                if (!node.children) { node.children = {}; }
                if (!node.children[part]) { node.children[part] = { uri:null, resource:null, children:null }; }
                node = node.children[part];
            }
            // set the resource
            node.uri = uri;
            node.resource = resources[uri];
        }
        return { code:200, body:rtree, 'content-type':'js/lshui.env+object' };
    };

    // Type interfaces
    // ===============
    Link.addToType('js/lshui.env+object', {
        toHtml:function() {
            return __toHtml({ children:this.data });
        }
    });
    // renders the resource tree
    var __toHtml = function(node) {
        var html = [];
        // add resource
        if (node.resource) {
            html.push('<li><a href="'+node.uri+'">'+node.uri+'</a> '+node.resource.desc+'</li>');
        } else if (node.uri) {
            html.push('<li>'+node.uri+'</li>');
        }
        // add children
        if (node.children) {
            html.push('<ul>');
            for (var uri in node.children) {
                html.push(__toHtml(node.children[uri]));
            }
            html.push('</ul>');
        }
        return html.join('');
    };

    return Module;
});