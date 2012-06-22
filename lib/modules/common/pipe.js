define(['link'], function() {
    var Module = function(config) {
        this.target = config.target;
        this.proxy_uri = config.proxy_uri;
    };

    Module.prototype.resources = {
        '/':{ desc:'Redirects the given request according to a configured target' }
    };

    Module.prototype.routes = {
        pipe:{ uri:"/?(.*)" }
    };

    Module.prototype.pipe = function(request, match, structure) {
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
        structure.dispatch(request, function(pipe_response) {
            request.uri = org_uri; // restore the uri
            promise.fulfill(pipe_response); // respond
        });
        return promise;
    };

    return Module;
});