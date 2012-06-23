define(['link'], function() {
    var Module = function() {
    };

    Module.prototype.resources = {
        GET:'Echoes "ok"'
    };

    Module.prototype.routes = {
        respond:{ uri:"^/?$" }
    };

    Module.prototype.respond = function() {
        return { code:200, body:'ok', 'content-type':'text/html' };
    };

    return Module;
});