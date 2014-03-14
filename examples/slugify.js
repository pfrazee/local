/**
 * httpl://httplocal.com(/examples/slugify.js)/
 */
importScripts('/local.min.js');
function main(req, res) {
	// Set headers
	res.header('Link', [{ href: '/', rel: 'self httplocal.com/transformer', id: 'slugify', title: 'Slugify' }]);
	res.header('Content-Type', 'text/plain');

	if (req.method == 'HEAD') {
		// Respond with headers only
		res.writeHead(204, 'OK, no content').end();
		return;
	}

	if (req.method == 'POST') {
		// Apply transformation
		res.writeHead(200, 'OK'); // because HTTPL is full-duplex, we can respond while the request is streaming
		req.on('data', function(chunk) { res.write(slugify(chunk)); });
		req.on('end',  function()      { res.end(); });
		return;
	}

	// Invalid method
	res.writeHead(405, 'Bad Method').end();
}

function slugify(s) {
	s = s.replace(/<[^>]+>/gi, '');
	s = s.replace(/&[^;\s]+;/gi, '');
	s = s.replace(/[^-a-z0-9_ ]/gi, '');
	s = s.replace(/\s+/gi, '-');
	s = s.replace(/_+$/i, '');
	s = s.replace(/_+/gi, '-');
	return s;
}