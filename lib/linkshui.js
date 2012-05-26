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
    
    // create http server
    return require('http').createServer(function(req, res) {
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
                var reason = link_res.reason || ''; delete link_res.reason;
                var body = link_res.body; delete link_res.body;
                // use the interface to produce the response
                if (body && link_req.accept != '*/*') {
                    // use a type interface to convert
                    var converted_body = null;
                    var body_iface = Link.getTypeInterface(link_res['content-type'], body);
                    // iterate through the accept types
                    var accept_types = link_req.accept.split(',');
                    for (var i=0; i < accept_types.length; i++) {
                        var type = accept_types[i];
                        converted_body = body_iface.convertToType(type);
                        if (converted_body) {
                            body = converted_body;
                            link_res['content-type'] = type;
                            break;
                        }
                    }
                }
                // make sure we give a string or buffer
                if (body && typeof body != 'string' && Buffer.isBuffer(body) != true) {
                    body = body.toString();
                }
                // write response
                res.writeHead(code, reason, link_res);
                res.end(body);
            });
        });
    });
};