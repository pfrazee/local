importScripts('../local.js');
importScripts('./marked.js');
marked.setOptions({ gfm: true, tables: true });

function main(req, res) {
	req.on('end', function() {
		res.writeHead(200, 'OK', {'Content-Type': 'text/html'});
		res.end(marked(''+req.body));
	});
}