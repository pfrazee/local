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

    // Logging
    if (env_config.logging_enabled) {
        //Link.logMode('traffic', true);
        //Link.logMode('routing', true);
        Link.logMode('err_types', true);
    }

    // Init environment libs
    Env.init(structure);
    LinkRegistry.init(env_config.links);
    CLI.init(structure, 'lshui-cli-input');
    History.init('lshui-hist');
    
    // Follow the given hash
    var uri = window.location.hash || '';
    if (uri.charAt(0) == '#') { uri = uri.substring(1); }
    CLI.runCommand('get '+uri+' [application/html+json]');
});
