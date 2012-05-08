var http_proxy = require('http-proxy');
var fs = require('fs');
var Link = require('link-js');

// modules
var LayoutModule = require('./link_modules/server/layout.js').Module;
var StaticFileModule = require('./link_modules/server/static_file.js').Module;
var LinkshuiEnvModule = require('./link_modules/server/env.js').Module;

exports.createServer = function(config) {
    // create link app
    var mediator = new Link.Mediator();
    mediator.addModule('/', new LayoutModule('linkshui v0.0.1', './lib/templates'));
    mediator.addModule('/', new LinkshuiEnvModule('./usercfg', './lib/templates'));
    mediator.addModule('/modules', new StaticFileModule('./lib/link_modules'));
    mediator.addModule('/assets', new StaticFileModule('./lib/assets'));
    
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
            // build link request
            var link_req = req.headers;
            link_req.uri = req.url;
            link_req.method = req.method;
            link_req.body = '';
            req.setEncoding('utf8');
            // collect request body
            req.on('data', function(chunk) {
                link_req.body += chunk;
            });
            req.on('end', function() {
                // run through link
                mediator.dispatch(link_req, function(link_res) {
                    // extract non-headers
                    var code = link_res.code; delete link_res.code;
                    var reason = link_res.reason; delete link_res.reason;
                    var body = link_res.body; delete link_res.body;
                    // write response
                    res.writeHead(code, reason, link_res);
                    res.end(body);
                });
            });
        }
    });
    return proxy_server;
};