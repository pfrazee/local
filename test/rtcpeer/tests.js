
done = false;
startTime = Date.now();

// Create peerweb relay streams
var peerWeb1 = local.joinPeerWeb('https://grimwire.net', peer1ServerFn, { stream: 0 });
var peerWeb2 = local.joinPeerWeb('https://grimwire.net', peer2ServerFn, { stream: 1 });

// Get access token if we need one
if (!sessionStorage.getItem('access-token')) {
	peerWeb1.on('accessGranted', function() {
		sessionStorage.setItem('access-token', peerWeb1.getAccessToken());
		window.location.reload();
	});
	peerWeb1.requestAccessToken();
} else {
	// Handle auth failures
	peerWeb1.on('accessInvalid', function() {
		peerWeb1.requestAccessToken();
	});

	// Pull access token from storage
	peerWeb1.setAccessToken(sessionStorage.getItem('access-token'));
	peerWeb2.setAccessToken(sessionStorage.getItem('access-token'));

	// Start listening
	peerWeb1.startListening();
	peerWeb2.startListening();

	peerWeb2.on('listening', function() {
		// Connect to self on second stream
		peerWeb1.connect(peerWeb1.getUserId(), { stream: 1 });
	});
}

var peer1API;
var peer2API;
peerWeb2.on('connected', function(data) {
	peer1API = local.navigator(data.server.getUrl());
	checkReady();
});
peerWeb1.on('connected', function(data) {
	peer2API = local.navigator(data.server.getUrl());
	print(data.user);
	print(data.app);
	print(data.domain);
	print(data.stream);
	print(typeof data.server);
	checkReady();
});
function checkReady() {
	if (!peer1API || !peer2API)
		return;
	print('ready');
	finishTest();
}

var counter1 = 0;
function peer1ServerFn(req, res) {
	if (req.path == '/' && req.method == 'GET') {
		res.writeHead(200, 'ok', { 'content-type': 'text/plain' });
		res.end(counter1++);
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
}

var counter2 = 100;
function peer2ServerFn(req, res) {
	if (req.path == '/' && req.method == 'GET') {
		res.writeHead(200, 'ok', { 'content-type': 'text/plain' });
		res.end(counter2--);
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
}

wait(function () { return done; });
/* =>
pfraze
dev.grimwire.com
dev.grimwire.com1_.pfraze_.grimwire.net
1
object
ready
*/

// Test: GET traffic

done = false;
startTime = Date.now();
var responses_ = [];
for (var i = 0; i < 10; i++) {
	responses_.push(peer1API.dispatch());
	responses_.push(peer2API.dispatch());
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
	responses_.push(peer1API.post('FooBar'));
	responses_.push(peer2API.post('FooBar'));
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