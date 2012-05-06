var http_proxy = require('http-proxy');
var node_static = require('node-static');
var fs = require('fs');

// cached configs
var user_configs = {};
    
var getUserConfig = function(name, cb) {
    // give cached version if exists
    if (name in user_configs) { return cb(user_configs[name]); }
    // read from disk
    fs.readFile('./usercfg/' + name + '.json', function(err, data) {
        if (err) { return cb(err); }
        // parse the JSON
        try { var cfg = JSON.parse(data); }
        catch (e) { cb(e); }
        user_configs[name] = cfg; // cache
        cb(null, cfg);
    });
};

// gets the environment config for the request
var getEnvironment = function(req, cb) {
    // :TODO: if an active session, use that config
    // if no session, use the `default` config
    getUserConfig('default', function(err, cfg) {
        if (err) { return cb(err); }
        // :TODO: check the authentication
        // :TODO: use the environment requested
        var env_name = 'welcome';
        cb(null, cfg.environments[env_name]);
    });
};


exports.createServer = function(config) {
    // create static file server
    var file_server = new node_static.Server('./lib/link_modules');
    
    // create proxy server
    var proxy_server = http_proxy.createServer(function(req, res, proxy) {
        // proxy request
        if (req.headers['x-link-dest']) {
            var parsed_url = require('url').parse(req.headers['x-link-dest']);
            var host_port = (parsed_url.port ? parsed_url.port : 80);
            console.log('routing ' + parsed_url.path, '; host: ' + parsed_url.hostname, 'port: ' + host_port);
            req.url = parsed_url.path;
            proxy.proxyRequest(req, res, {
                host: parsed_url.hostname,
                port: host_port
            });
        }
        // local request
        else {
            // :TODO: run through link
            var parsed_url = require('url').parse(req.url);
            if (parsed_url.pathname.indexOf('/modules/') == 0) {
                // asset request
                req.url = req.url.substring(9);
                file_server.serve(req, res);
            } else {
                // environment request
                getEnvironment(req, function(err, env) {
                    if (err) {
                        // :TODO: generate html
                    } else {
                        // :TODO: generate html
                        envView = new EnvironmentView(env);
                        res.end(envView.toString());
                    }
                });
            }
        }
    });
    return proxy_server;
};