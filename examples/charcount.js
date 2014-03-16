/**
 * httpl://httplocal.com(/examples/charcount.js)/
 */
importScripts('/local.min.js');
function main(req, res) {
	// Set headers
	res.header('Link', [{ href: '/', rel: 'self stdrel.com/transformer', id: 'charcount', title: 'Character Count (total stream)' }]);
	res.header('Content-Type', 'text/plain');

	if (req.method == 'HEAD') {
		// Respond with headers only
		res.writeHead(204, 'OK, no content').end();
		return;
	}

	if (req.method == 'POST') {
		// Apply transformation
		res.writeHead(200, 'OK'); // because HTTPL is full-duplex, we can respond while the request is streaming
		var count = 0;
		req.on('data', function(chunk) { count += chunk.length; });
		req.on('end',  function()      { res.end(''+count); });
		return;
	}

	// Invalid method
	res.writeHead(405, 'Bad Method').end();
}