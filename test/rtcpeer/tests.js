
done = false;
startTime = Date.now();

var peer1, peer2;
var peer1Server, peer2Server;
var peer1API, peer2API;
var relayStream1 = local.subscribe('httpl://relay');
var relayStream2 = local.subscribe('httpl://relay');
relayStream1.on('ident', function(e) { peer1 = e.data; });
relayStream1.on('join', function(e) {
	peer2 = e.data;
	peer2Server = local.spawnRTCPeerServer(peer2, relayStream1, { initiateAs: peer1 });
	setupPeer2Server(peer2Server);
	peer2API = local.navigator('httpl://'+peer2Server.config.domain);
});
relayStream2.on('initiate', function(e) {
	// e.data == peer1
	peer1Server = local.spawnRTCPeerServer(e.data, relayStream2);
	setupPeer1Server(peer1Server);
	peer1API = local.navigator('httpl://'+peer1Server.config.domain);
	print('ready');
	finishTest();
});

function setupPeer1Server(s) {
	var counter = 0;
	s.handleRemoteWebRequest = function(req, res) {
		if (req.path == '/' && req.method == 'GET') {
			res.writeHead(200, 'ok', { 'content-type': 'text/plain' });
			res.end(counter++);
			return;
		}
		if (req.path == '/' && req.method == 'POST') {
			req.finishStream().then(function(body) {
				res.writeHead(200, 'ok', { 'content-type': 'text/plain' });
				res.end(body.toUpperCase());
			});
			return;
		}
		res.writeHead(404, 'not found').end();
	};
}

function setupPeer2Server(s) {
	var counter = 100;
	s.handleRemoteWebRequest = function(req, res) {
		if (req.path == '/' && req.method == 'GET') {
			res.writeHead(200, 'ok', { 'content-type': 'text/plain' });
			res.end(counter--);
			return;
		}
		if (req.path == '/' && req.method == 'POST') {
			req.finishStream().then(function(body) {
				res.writeHead(200, 'ok', { 'content-type': 'text/plain' });
				res.end(body.toLowerCase());
			});
			return;
		}
		res.writeHead(404, 'not found').end();
	};
}

wait(function () { return done; });
// => ready


// Test: GET traffic

done = false;
startTime = Date.now();
var responses_ = [];
for (var i = 0; i < 10; i++) {
	responses_.push(peer2API.dispatch());
	responses_.push(peer1API.dispatch());
}

local.promise.bundle(responses_)
	.always(function(responses) {
		responses.forEach(function(res) {
			print(res.body);
		});
		finishTest();
	});
wait(function () { return done; });

/* =>
100
1
99
2
98
3
97
4
96
5
95
6
94
7
93
8
92
9
91
*/

// Test: POST traffic

done = false;
startTime = Date.now();
var responses_ = [];
for (var i = 0; i < 10; i++) {
	responses_.push(peer2API.post('FooBar'));
	responses_.push(peer1API.post('FooBar'));
}

local.promise.bundle(responses_)
	.always(function(responses) {
		responses.forEach(function(res) {
			print(res.body);
		});
		finishTest();
	});
wait(function () { return done; });

/* =>
FOOBAR
foobar
FOOBAR
foobar
FOOBAR
foobar
FOOBAR
foobar
FOOBAR
foobar
FOOBAR
foobar
FOOBAR
foobar
FOOBAR
foobar
FOOBAR
foobar
FOOBAR
foobar
*/