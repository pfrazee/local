require.config({
    paths:{
        link:'../assets/js/link'
    }
});
var paths = [
    'link',
    'lib/env',
    'lib/linkregistry',
    'lib/cli',
    'lib/history',
    'modules/linkshui/order-dm'
];
var def_module_count = paths.length;

// Extract all module paths
var ordered_uris = [];
for (var i=0; i < env_config.structure.length; i++) {
    paths.push('modules/' + env_config.structure[i].module);
}
// Load using require js
require(paths, function(Link, Env, LinkRegistry, CLI, History, LinkshuiOrderDm) {
    // Enable proxy
    //Link.ajaxConfig('proxy',''); set this to the URL of your proxy
    
    // Build structure
    var structure = new Link.Structure();
    structure.addModule('#dm', new LinkshuiOrderDm(structure, { uri:'#dm', container_id:'lshui-env' }));
 
    // Add config modules
    var Modules = Array.prototype.slice.call(arguments, def_module_count);
    for (var i=0; i < env_config.structure.length; i++) {
        var uri = env_config.structure[i].uri;
        var Module = Modules[i];
        structure.addModule(uri, new Module(structure, env_config.structure[i]));
    }   

    // Init environment libs
    Env.init(structure);
    LinkRegistry.init(env_config.links);
    CLI.init(structure, 'lshui-cli-input');
    History.init('lshui-hist');

    // Logging
    if (env_config.logging_enabled) {
        Link.logMode('traffic', true);
        //Link.logMode('routing', true);
        Link.logMode('err_types', true);
    }
    
    // Wire the app to the window
    Link.attachToWindow(structure, function(request, response) {
        // Add to the history
        var cmd = request.method + ' ' + request.uri;
        History.addEntry(cmd, response);
        // Process
        Env.handleResponse(response);
    });
    
    // Follow the given hash
    // :TODO: give this time to simmer
    /*var uri = window.location.hash;
    if (uri != null && uri == '' && uri != '/') { 
        Link.followRequest({ method:'get', uri:uri, accept:'text/html' });
    }*/

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
