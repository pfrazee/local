// Env
// ===
// serves linkshui environments

var Link = require('linkjs');
var Tint = require('tintjs');
var path = require('path');
var fs = require('fs');
var EnvironmentTemplate = null; // loaded in the constructor

var Env = function(cfg_path, template_path) {
    this.cfg_path = cfg_path;
    this.template_path = template_path;
    // cached configs
    this.user_configs = {};
    // load the template, if needed
    if (!EnvironmentTemplate && template_path) {
        template_path = path.resolve(path.join(template_path, 'environment.html'));
        fs.readFile(template_path, 'utf8', function(err, data) {
            if (err) { console.log('Unable to find environment template at', template_path); }
            else {
                EnvironmentTemplate = new Tint.compile(data, function(env_config) {
                    this.env_config = JSON.stringify(env_config);
                });
            }
        });
    }
};

// Resource Meta
// =============
Env.prototype.resources = {
    '/':{
        desc:'Linkshui user environments. Provides the configuration for an instance to load.',
        _get:'Provdes default user, default environment.'
    }
    // :TODO: do we want to preload all configs and register their resources?
    // (might not be worth it)
};

// Type interfaces
// ===============
Link.addToType('js/lshui.env+object', {
    toHtml:function() {
        var envTmpl = new EnvironmentTemplate(this.data);
        return envTmpl.toString()
    }
});

// Route Handlers
// ==============
Env.prototype.routes = {
    defaultDefaultHandler:{ uri:'^/?$', method:'get' },
    userDefaultHandler:{ uri:'^/env/([^/]+)/?$', method:'get' },
    userEnvHandler:{ uri:'^/env/([^/]+)/([^/]+)/?$', method:'get' }
};
Env.prototype.defaultDefaultHandler = function(request) {
    return this.serveEnv('default', 'default');
};
Env.prototype.userDefaultHandler = function(request, match) {
    return this.serveEnv(match.uri[1], 'default');
};
Env.prototype.userEnvHandler = function(request, match) {
    return this.serveEnv(match.uri[1], match.uri[2]);
};

// Helpers
// =======
Env.prototype.getUserConfig = function(name, cb) {
    // give cached version if exists
    if (name in this.user_configs) { return cb(null, this.user_configs[name]); }
    // read from disk
    var file_path = path.resolve(path.join(this.cfg_path, name + '.json'));
    fs.readFile(file_path, 'utf8', function(err, data) {
        if (err) { return cb(err); }
        cb(null, data);
    });
};

Env.prototype.serveEnv = function(user, env) {
    var self = this;
    var promise = new Link.Promise();
    // read the file
    this.getUserConfig(user, function(err, cfg) {
        if (err) { return promise.fulfill({ code:404 }); }
        // parse the JSON
        if (typeof cfg == 'string') {
            try { cfg = JSON.parse(cfg); }
            catch (e) { return promise.fulfill({ code:500, body:e.toString() }); } // :TODO: need to gracefully handle this event
        }
        // cache
        self.user_configs[user] = cfg;
        // :TODO: authenticate session
        if (!(env in cfg.environments)) {
            env = 'default';
        }
        // generate html
        promise.fulfill({ code:200, body:cfg.environments[env], 'content-type':'js/lshui.env+object' });
    });
    return promise;
};

// export
exports.Module = Env;