require.config({
    paths:{
        link:'../js/link'
    }
});
var paths = [
    'link',
    'lib/linkregistry',
    'linkshui/cli',
    'linkshui/history',
    'linkshui/order-dm'
];
var def_module_count = paths.length;

// Extract all module paths
var ordered_uris = [];
for (var i=0; i < env_config.structure.length; i++) {
    paths.push(env_config.structure[i].module);
}
// Load using require js
require(paths, function(Link, LinkRegistry, LinkshuiCli, LinkshuiHistory, LinkshuiOrderDm) {
    // Enable proxy
    //Link.ajaxConfig('proxy',''); set this to the URL of your proxy
    
    // Build environment
    var env = new Link.Structure();
    env.addModule('#hist', new LinkshuiHistory(env));
    env.addModule('#cli', new LinkshuiCli(env, 'lshui-cli-input'));
    env.addModule('#dm', new LinkshuiOrderDm(env, { uri:'#dm', container_id:'lshui-env' }));
    LinkRegistry.init(env_config.links);

    // Add config modules
    var Modules = Array.prototype.slice.call(arguments, def_module_count);
    for (var i=0; i < env_config.structure.length; i++) {
        var uri = env_config.structure[i].uri;
        var Module = Modules[i];
        env.addModule(uri, new Module(env, env_config.structure[i]));
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
                    // Set in dom
                    document.getElementById('lshui-hist').innerHTML = response.body.toString();
                });
            });
        }
        // Stop processing if no content was provided
        if (response.code == 204 || response.code == 205) { return; }
        // Update link registry
        LinkRegistry.update(response.link);
        // Send to the div manager
        var html = (response.body ? response.body.toString() : '');
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
