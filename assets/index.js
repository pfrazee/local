// Traffic logging
local.logAllExceptions = true;
local.setDispatchWrapper(function(req, res, dispatch) {
	var res_ = dispatch(req, res);
	res_.then(
		function() { console.log(req, res); },
		function() { console.error(req, res); }
	);
});

// Request events
try { local.bindRequestEvents(document.body); }
catch (e) { console.error('Failed to bind body request events.', e); }
document.body.addEventListener('request', function(e) {
	local.dispatch(e.detail);
});

// User album rendering
var albumDesc = { name: 'Wish You Were Here', image: '/assets/album.png', description: 'Breathe, breathe in the air. Don\'t be afraid to care. Leave but don\'t leave me. Look around and chose your own ground.' };
local.addServer('album-manager', function(req, res) {
	req.on('end', function() {
		var src = 'data:application/javascript;base64,'+btoa(req.body.src);
		var renderer = local.spawnWorkerServer(src, {
			domain: 'album-renderer',
			temp: true, // close after all requests are handled
			onerror: function() {
				renderer.terminate();
				$('#album-out').html('<strong class="text-error">There was an error running the script. Check the console for syntax errors and try again.</strong>');
			}
		});
		local.POST(albumDesc, 'local://album-renderer')
			.then(function(res2) {
				$('#album-out').html(res2.body);
				res.writeHead(204).end();
			})
			.fail(function(res) {
				console.error(res);
				res.writeHead(400).end();
			});
	});
});

// Pipes server
var pipesLinks = [];
local.addServer('pipes', function(req, res) {
	if (req.path != '/') { return res.writeHead(404, 'Not Found').end(); }
	if (req.method == 'ADD') {
		$('#pipes-errout').html('');
		req.on('end', function() {
			if (!req.body.url) {
				$('#pipes-errout').html('URL is required.');
				return res.writeHead(422, 'Invalid Entity').end();
			}
			verifyTransformer(req.body.url).then(function(selfLink) {
				$('#url-input').val('');
				pipesLinks.push(selfLink);
				renderPipeline();
				res.writeHead(204, 'OK, no content').end();
			}).fail(function(err) {
				if (typeof err.status != 'undefined') {
					$('#pipes-errout').html(err.status + ': ' + err.reason);
				} else {
					$('#pipes-errout').html(err.toString());
				}
				res.writeHead(422, 'Invalid Entity').end();
			});
		});
		return;
	}
	res.writeHead(405, 'Invalid Method').end();
});

// Verify the given URL is a transformer
function verifyTransformer(url) {
	return local.HEAD(url).then(function(res) {
		var selfLink = local.queryLinks(res, { rel: 'self stdrel.com/transformer' })[0];
		if (!selfLink) {
			throw 'Not a valid transformer';
		}
		return selfLink;
	});
}

// Draw current links, then run sequence and output data
function renderPipeline() {
	$('#pipes-sequence').html(pipesLinks.map(function(link) {
		var url = local.UriTemplate.parse(link.href).expand({});
		var title = link.title || link.id || url;
		return makeSafe(title);
	}).join('<br>'));
	$('#pipes-errout').html('Running...');
	var outs = {};
	execSequence(
		function(i, s) {
			if (!outs[i]) outs[i] = '';
			outs[i] += s;
			renderOutput(outs);
		},
		function() {
			$('#pipes-errout').html('Done!');
			renderOutput(outs);
		}
	).write('Welcome, my son. Welcome... to the machine.').end();
}

function renderOutput(outs) {
	var out = '';
	for (var k in outs) {
		out += '<strong>Output '+(+k+1)+'</strong>: '+makeSafe(outs[k])+'<br>';
	}
	$('#pipes-output').html(out);
}

function execSequence(outCb, doneCb) {
	var requests = [];
	pipesLinks.forEach(function(link, i) {
		var url = local.UriTemplate.parse(link.href).expand({});
		// Create a new request stream and add it to our array
		var req = new local.Request({
			method: 'POST',
			url: url,
			Content_Type: 'text/plain',
			Accept: 'text/plain',
			stream: true
		});
		requests.push(req);

		// Start the request stream
		local.dispatch(req).always(function(res) {
			// On each chunk, pipe or emit
			res.on('data', function(chunk) {
				outCb(i, chunk);
				if (requests[i+1]) { requests[i+1].write(chunk); }
			});
			// On each 'end', cascade the stream-close
			res.on('end', function() {
				delete requests[i];
				if (i+1 === pipesLinks.length) { closeRequests(); doneCb(); }
				else if (requests[i+1])  { requests[i+1].end(); }
			});
		});
	});
	// Helper to shutdown any unclosed streams at exit
	function closeRequests() {
		requests.forEach(function(req) { if (req) { req.end(); }});
	}
	return requests[0];
}

function makeSafe(str) {
	return str.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}