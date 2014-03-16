/**
 * httpl://httplocal.com(/examples/toupper.js)/
 */
importScripts('/local.js');
function main(req, res) {
	// Set headers
	res.header('Link', [{ href: '/', rel: 'self stdrel.com/transformer', id: 'toupper', title: 'To Uppercase' }]);
	res.header('Content-Type', 'text/plain');

	if (req.method == 'HEAD') {
		// Respond with headers only
		res.writeHead(204, 'OK, no content').end();
		return;
	}

	if (req.method == 'POST') {
		// Apply transformation
		res.writeHead(200, 'OK'); // because HTTPL is full-duplex, we can respond while the request is streaming
		req.on('data', function(chunk) { res.write(chunk.toUpperCase()); });
		req.on('end',  function()      { res.end(); });
		return;
	}

	// Invalid method
	res.writeHead(405, 'Bad Method').end();
}