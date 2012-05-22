var paths = [
    '/assets/js/link.js',
    'linkshui/cli',
    'linkshui/history',
    'linkshui/order-dm'
];
var def_module_count = paths.length;

// Extract all module paths
var ordered_uris = [];
for (var uri in env_config.structure) {
    paths.push(env_config.structure[uri].__file);
    ordered_uris.push(uri); // remember the order so we can match them up (prob not necessary)
}
// Load using require js
require(paths, function(_, LinkshuiCli, LinkshuiHistory, LinkshuiOrderDm) {
    // Build environment
    var env = new Link.Mediator();
    env.addModule('#hist', new LinkshuiHistory());
    env.addModule('#cli', new LinkshuiCli('lshui-cli-input'));
    env.addModule('#dm', new LinkshuiOrderDm('lshui-env'));

    // Add config modules
    var Modules = Array.prototype.slice.call(arguments, def_module_count);
    for (var i=0; i < ordered_uris.length; i++) {
        var uri = ordered_uris[i];
        var Module = Modules[i];
        env.addModule(uri, new Module(env_config.structure[uri]));
    }

    // Logging
    if (env_config.logging_enabled) {
        Link.logMode('traffic', true);
    }
    
    // Wire the app to the window
    Link.attachToWindow(env, function(request, response) {
        // Add to the history (unless the cli, which will do it on its own)
        if (!(request.uri == '#cli' && request.method == 'post')) {
            var cmd = request.method + ' ' + request.uri;
            env.dispatch({ uri:'#hist', method:'post', 'content-type':'js/object', body:{ cmd:cmd, response:response }}, function() {
                env.dispatch({ uri:'#hist', method:'get', 'accept':'text/html' }, function(response) {
                    // Get HTML out of the response
                    var html = Link.getTypeInterface(response['content-type'], response.body).toHtml();
                    document.getElementById('lshui-hist').innerHTML = html;
                });
            });
        }
        // Stop processing if no content was provided
        if (response.code == 204 || response.code == 205) {
            return;
        }
        // Get HTML out of the response
        var html;
        if (response['content-type']) {
            html = Link.getTypeInterface(response['content-type'], response.body).toHtml();
        } else {
            html = (response.body ? (response.body.toString ? response.body.toString() : response.body) : '');
        }
        // Send to the div manager
        env.dispatch({ uri:'#dm/0', method:'put', 'content-type':'text/html', body:html });
    });
    
    // Set up the prompt
    var prompt_elem = document.getElementById('lshui-cli-prompt');
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var twoDigits = function(v) { return ((v < 10) ? '0' : '') + v; };
    var setPrompt = function() {
        var now = new Date();
        var tickanim = ['&#9777;','&#9778;','&#9780;','&#9782;','&#9783;','&#9779;'];
        prompt_elem.innerHTML = '' + twoDigits(now.getHours()) + ':' + twoDigits(now.getMinutes()) + tickanim[now.getSeconds() % tickanim.length] + ' ' + months[now.getMonth()] + twoDigits(now.getDate());
    };
    setInterval(setPrompt, 1000);
    setPrompt();
});