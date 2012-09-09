var env_config = {
    logging_enabled:1,
    structure:[
        // Apps
        { 
            uri:'/app/inbox', 
            module:'pfraze/inbox', 
            services:[
                { name:'@linkshui', uri:'http://linkshui.com:8600' },
                { name:'Fixture', uri:'/serv/inbox/fixture' }
            ]
        },
        { uri:'/app/statfeed', module:'pfraze/statfeed', service:{ uri:'/serv/statusnet/api' }},
        { uri:'/app/cab', module:'pfraze/cabinet', service:{ uri:'/serv/files' }},
        { uri:'/app/jeo', module:'wjosdejong/jsoneditor' },
        { uri:'/app/commander', module:'pfraze/commander' },
        { uri:'/app/runbox', module:'pfraze/runbox' },
        { uri:'/app/htmler', module:'pfraze/htmler' },

        // Services
        { uri:'/serv/inbox/fixture', module:'pfraze/inbox-srvc-fixture', name:'Fixture' }
    ]
};

document.addEventListener('DOMContentLoaded', function() {
    // Extract all module paths
    /*var ordered_uris = [];
    for (var i=0; i < env_config.structure.length; i++) {
        paths.push('modules/' + env_config.structure[i].module);
    }*/

    // Build structure :TODO:
    var router = new HttpRouter();
    router.ajaxConfig('proxy', '/serv/proxy'); 
    /*structure.addModule('', new AgentServer(structure, { uri:'' }));
 
    // Add config modules
    var Modules = Array.prototype.slice.call(arguments, def_module_count);
    for (var i=0; i < env_config.structure.length; i++) {
        var uri = env_config.structure[i].uri;
        var Module = Modules[i];
        structure.addModule(uri, new Module(structure, env_config.structure[i]));
    }*/

    if (env_config.logging_enabled) {
        Util.logMode('traffic', true);
        //Util.logMode('routing', true);
        //Util.logMode('err_types', true);
    }

    Env.init(router, 'lshui-env');

    // temporary -- get things started
    var a = Env.makeAgent('debug');
    a.loadProgram('/modules/pfraze/debug.js').then(function() {
        a.follow({ uri:'/debug', method:'get', accept:'text/html' });
    });
});
