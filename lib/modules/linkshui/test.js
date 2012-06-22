define(['link'], function() {
    var Module = function() {
    };

    Module.prototype.resources = {
        '/': {
            desc:'A simple echo',
            _get:'Responds with the URI of the module.'
        }
    };

    Module.prototype.routes = {
        respond:{ uri:"^/?$" }
    };

    Module.prototype.respond = function() {
        return { code:200, body:'ok', 'content-type':'text/html' };
    };

    return Module;
});