define(['link'], function(Link) {
    var Module = function(structure, config) {
        this.structure = structure;
        this.target = config.target;
        this.proxy_uri = config.proxy_uri;
    };

    Module.prototype.routes = [
        Link.route('pipe', { uri:"/?(.*)" })
    ];

    Module.prototype.pipe = function(request, match) {
        var promise = new Link.Promise();
        // update the uri
        var org_uri = request.uri;
        var new_uri = this.target + match.uri[1];
        // use proxy if given
        if (this.proxy_uri) {
            request.uri = this.proxy_uri;
            request['x-link-dest'] = new_uri;
        } else {
            request.uri = new_uri;
        }
        // dispatch
        this.structure.dispatch(request, function(pipe_response) {
            request.uri = org_uri; // restore the uri
            promise.fulfill(pipe_response); // respond
        });
        return promise;
    };

    return Module;
});
