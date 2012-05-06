var http_proxy = require('http-proxy');

exports.createServer = function() {
    // create proxy server
    var server = http_proxy.createServer(function(req, res, proxy) {
        // proxy request
        if (req.headers['x-link-dest']) {
            var parsed_url = require('url').parse(req.headers['x-link-dest']);
            var host_port = (parsed_url.port ? parsed_url.port : 80);
            req.url = parsed_url.path;
	        console.log('routing ' + req.url, '; host: ' + parsed_url.hostname, 'port: ' + host_port);
	        proxy.proxyRequest(req, res, {
                host: parsed_url.hostname
		        , port: host_port
	        });
        }
        // local request
        else {
            // :TODO:
	        proxy.proxyRequest(req, res, {
                host: 'localhost'
		        , port: options.client_port
	        });
        }
    });
    return server;
};