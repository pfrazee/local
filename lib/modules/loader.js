var paths = [
    '/assets/js/link.js',
    'linkshui/cli',
    'linkshui/history'
];
var def_module_count = paths.length;

// Extract all module paths
var ordered_uris = [];
for (var uri in env_config.structure) {
    paths.push(env_config.structure[uri].__file);
    ordered_uris.push(uri); // remember the order so we can match them up (prob not necessary)
}
// Load using require js
require(paths, function(_, LinkshuiCli, LinkshuiHistory) {
    // Build environment
    var env = new Link.Mediator('lshui-env');
    env.addModule('#', new LinkshuiHistory('#cli'));
    env.addModule('#cli', new LinkshuiCli('lshui-cli-input'));

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
    
    // Start app
    Link.attachToWindow(env);
    
    // Set up the prompt
    var prompt_elem = document.getElementById('lshui-cli-prompt');
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var twoDigits = function(v) { return ((v < 10) ? '0' : '') + v; };
    var setPrompt = function() {
        var now = new Date();
        prompt_elem.innerHTML = '' + twoDigits(now.getHours()) + ':' + twoDigits(now.getMinutes()) + ' ' + months[now.getMonth()] + twoDigits(now.getDate());
    };
    setInterval(setPrompt, 10000); // Update every 10 seconds, which is precise enough for minutes
    setPrompt();
});