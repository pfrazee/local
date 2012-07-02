define(['link', './spahql-min'], function(Link) {
    var Module = function() {
    };

    Module.prototype.routes = [
        Link.route('banner', { uri:"^/?$", method:'get' }),
        Link.route('apply', { uri:"^/?$", method:'post' })
    ];

    Module.prototype.banner = function() {
        return Link.response(200, '<h3>SpahQL <small>by Dan Glegg (<a href="https://github.com/danski/spahql" title="github repo">https://github.com/danski/spahql</a>)</small></h3><p>For usage information (and a live REPL) <a href="http://danski.github.com/spahql/repl.html" title="Documentation">visit the docs site</a>.', 'text/html');
    };

    Module.prototype.apply = function(request) {
        // Pull data, if it exists
        var data = request.body || {};

        // Build spahql container
        var db = SpahQL.db(data);

        // Pull params
        var select = request.select || request.s || '';

        // Run
        try {
            var q = db.select(select);
            return Link.response(200, q.values(), 'obj');
        } catch(e) {
            console.log('spahql exception', e);
            return Link.response(400, 'unable to process query', 'text/html');
        }
    };

    return Module;
});
