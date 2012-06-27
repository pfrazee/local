define(['link'], function() {
    var Module = function() {
    };

    Module.prototype.routes = [
        Link.route('respond', { uri:"^/?$" })
    ];

    Module.prototype.respond = function(request) {
        if (request.accept == 'js') {
            return Link.response(200, { a:'1', b:'2', c:'3' }, 'obj');
        }
        return Link.response(200, 'ok', 'text/html');
    };

    return Module;
});