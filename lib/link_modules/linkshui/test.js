define(function() {
    var Module = function() {
    };

    Module.prototype.routes = [
        { cb:"respond", uri:"^/?$" }
    ];

    Module.prototype.respond = function() {
        return { code:200, body:'ok', 'content-type':'text/html' };
    };

    return Module;
});