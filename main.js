require.config({
    paths:{
        link:'../assets/js/link',
        notify:'../assets/js/notify.min'
    }
});
var paths = [
    'link',
    'env/env',
    'env/cli',
    'env/simple-agent-server'
];
var def_module_count = paths.length;

// Extract all module paths
var ordered_uris = [];
for (var i=0; i < env_config.structure.length; i++) {
    paths.push('apps/' + env_config.structure[i].module);
}
// Load using require js
require(paths, function(Link, Env, CLI, AgentServer) {
    // Enable proxy
    Link.ajaxConfig('proxy', '/serv/proxy'); 
    
    // Build structure
    var structure = new Link.Structure();
    structure.addModule('', new AgentServer(structure, { uri:'' }));
 
    // Add config modules
    var Modules = Array.prototype.slice.call(arguments, def_module_count);
    for (var i=0; i < env_config.structure.length; i++) {
        var uri = env_config.structure[i].uri;
        var Module = Modules[i];
        structure.addModule(uri, new Module(structure, env_config.structure[i]));
    }   

    // Logging
    if (env_config.logging_enabled) {
        Link.logMode('traffic', true);
        //Link.logMode('routing', true);
        //Link.logMode('err_types', true);
    }

    // Init environment libs
    Env.init(structure, 'lshui-env');
});
