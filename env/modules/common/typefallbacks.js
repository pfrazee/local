define(['link'], function(Link) {
    var Module = function(structure, config) {
        this.structure = structure;
        this.target = config.target;
        this.proxy_uri = config.proxy_uri;
    };

    Module.prototype.routes = [
        Link.route('objToHtml', { uri:"/?(.*)", accept:'html' }, true),
        Link.route('objToJson', { uri:"/?(.*)", accept:'json' }, true)
    ];

    Module.prototype.objToHtml = function(request, match, response) {
        if (response.body && /obj/.test(response['content-type'])) {
            response.body = JSON.stringify(response.body);
            response['content-type'] = 'text/html';
        }
        return response;
    };

    Module.prototype.objToJson = function(request, match, response) {
        if (response.body && /obj/.test(response['content-type'])) {
            response.body = JSON.stringify(response.body);
            response['content-type'] = 'application/json';
        }
        return response;
    };

    return Module;
});
