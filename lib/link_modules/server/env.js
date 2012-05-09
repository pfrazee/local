// Env
// ===
// serves linkshui environments

var Link = require('link-js');
var Tint = require('tint-js');
var path = require('path');
var fs = require('fs');

var Env = function(cfg_path, template_path) {
    this.cfg_path = cfg_path;
    this.template_path = template_path;
    // cached configs
    this.user_configs = {};
    // load the template
    var self = this;
    var template_path = path.resolve(path.join(template_path, 'environment.html'));
    fs.readFile(template_path, 'utf8', function(err, data) {
        if (err) { console.log('Unable to find environment template at', template_path); }
        else {
            self.EnvironmentTemplate = new Tint.compile(data, function(env_config) {
                this.env_config = JSON.stringify(env_config);
            });
        }
    });
};

// Routes
// ======
Env.prototype.routes = [
    { cb:'defaultDefaultHandler', uri:'^$', accept:'text/html' },
    { cb:'userDefaultHandler', uri:'^env/([^/]+)/?$', accept:'text/html' },
    { cb:'userEnvHandler', uri:'^env/([^/]+)/([^/]+)/?$', accept:'text/html' }
];

// Handlers
// ========
Env.prototype.defaultDefaultHandler = function(request) {
    return this.serveEnv('default', 'default');
};
Env.prototype.userDefaultHandler = function(request, response, match) {
    return this.serveEnv(match.uri[1], 'default');
};
Env.prototype.userEnvHandler = function(request, response, match) {
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
        envTmpl = new self.EnvironmentTemplate(cfg.environments[env]);
        promise.fulfill({ code:200, body:envTmpl.toString(), 'content-type':'text/html' });
    });
    return promise;
};

// export
exports.Module = Env;