define(['link', './spahql-min'], function() {
    var Module = function() {
    };

    Module.prototype.resources = {
        GET:'Dan Glegg\'s SpahQL: Query, manipulate and manage JSON data effortlessly.',
        POST:'Applies select, or replace if a replace header is provided'
    };

    Module.prototype.routes = {
        banner:{ uri:"^/?$", method:'get' },
        apply:{ uri:"^/?$", method:'post' }
    };

    Module.prototype.banner = function() {
        return { code:200, body:'<h3>SpahQL <small>by Dan Glegg (<a href="https://github.com/danski/spahql" title="github repo">https://github.com/danski/spahql</a>)</small></h3><p>For usage information (and a live REPL) <a href="http://danski.github.com/spahql/repl.html" title="Documentation">visit the docs site</a>.', 'content-type':'text/html' };
    };

    Module.prototype.apply = function(request) {
        // Pull data, if it exists
        var data = {};
        if (request.body) {
            var type_iface = Link.getTypeInterface(request['content-type'], request.body);
            data = (type_iface && type_iface.toObject) ? type_iface.toObject() : request.body;
        }

        // Build spahql container
        var db = SpahQL.db(data);

        // Pull params
        var select = '';
        if (request.argv) { select = request.argv.join(''); }

        // Run
        try {
            var q = db.select(select);
            return { code:200, body:q.values(), 'content-type':'js/object' }
        } catch(e) {
            console.log('spahql exception', e);
            return { code:400, body:'unable to process query' };
        }
    };

    return Module;
});