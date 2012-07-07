define(['link', './prettify/prettify'], function(Link) {
    var Module = function(structure, config) {
        // add stylesheet
        var style = document.createElement('link');
        style.href = '/env/modules/google/prettify/prettify.css';
        style.rel = 'stylesheet'; style.media = 'screen';
        document.head.appendChild(style);
    };
    
    // Route Handlers
    // ==============
    Module.prototype.routes = [
        Link.route('banner', { uri:'^/?$', method:'get' }),
        Link.route('prettify', { uri:'^/?$', method:'post' }),
    ];
    Module.prototype.banner = function() {
        return { code:200, body:'<h3>Prettify <small>by Google (<a href="http://code.google.com/p/google-code-prettify/" title="google code repo">http://code.google.com/p/google-code-prettify/</a>)</small></h3><p>documentation todo.', 'content-type':'text/html' };
    };
    Module.prototype.prettify = function(request, match, structure) {
        // Get the contents
        var content = request.body ? request.body.toString() : ''; 
        return Link.response(200, '<br /><pre class="prettyprint">'+content+'</pre>', 'text/html', { onrender:prettyPrint });
    };

    return Module;
});
