define(['link'], function() {
    var Module = function() {
    };

    Module.prototype.routes = [
        Link.route('respond', { uri:"^/?$" }),
        Link.route('links', { uri:"^/?$" })
    ];

    Module.prototype.respond = function(request) {
        if (request.accept == 'obj') {
            return Link.response(200, { a:'1', b:'2', c:'3' }, 'obj');
        }
        return Link.response(200, 'ok', 'text/html');
    };

    Module.prototype.links = function(request, match, response) {
        response.link = [{ uri:'#', rel:'test' }];
        return response;
    };

    return Module;
});