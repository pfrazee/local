var http_proxy = require('http-proxy');
var fs = require('fs');
var Link = require('pfraze-linkjs');

// modules
var LayoutModule = require('./modules/server/layout.js').Module;
var StaticFileModule = require('./modules/server/static_file.js').Module;
var LinkshuiEnvModule = require('./modules/server/env.js').Module;

exports.createServer = function(config) {
    // create link app
    var mediator = new Link.Mediator();
    mediator.addModule('/', new LayoutModule('linkshui v0.0.1', './lib/templates'));
    mediator.addModule('/', new LinkshuiEnvModule('./usercfg', './lib/templates'));
    mediator.addModule('/modules', new StaticFileModule('./lib/modules'));
    mediator.addModule('/assets', new StaticFileModule('./lib/assets'));
    
    // create proxy server
    var proxy_server = http_proxy.createServer(function(req, res, proxy) {
        // proxy request
        if (req.headers['x-link-dest']) {
            // pull out destination
            var parsed_url = require('url').parse(req.headers['x-link-dest']);
            var path = (parsed_url.hostname ? parsed_url.path : ''); // path becomes hostname if schema is missing
            var protocol = parsed_url.protocol ? parsed_url.protocol : 'http:';
            var host = parsed_url.hostname || parsed_url.path; // if no hostname, probably because no scheme
            var host_port = parsed_url.port || (protocol == 'https:' ? 443 : 80); 
            // prepare request
            console.log('routing ' + protocol + '//' + host + ':' + host_port + path);
            req.headers.host = host;
            req.url = path;
            delete req.headers['x-link-dest'];
            // proxy
            proxy.proxyRequest(req, res, {
                host:host,
                port:host_port,
                https:(protocol == 'https:')
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