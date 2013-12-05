
done = false;
startTime = Date.now();

// Create peerweb relay streams
var relay1 = local.joinRelay('https://grimwire.net', { sid: 0, log: true }, peer1ServerFn);
var relay2 = local.joinRelay('https://grimwire.net', { sid: 1 }, peer2ServerFn);

relay1.on('accessGranted', function() {
	sessionStorage.setItem('access-token', relay1.getAccessToken());
	// Start listening
	relay1.startListening();
	relay2.startListening();
});

// Handle auth failures
relay1.on('accessInvalid', function() {
	relay1.requestAccessToken();
	relay1.on('accessGranted', function() { window.location.reload(); });
});

// Get access token if we need one
if (!sessionStorage.getItem('access-token')) {
	relay1.requestAccessToken();
	relay1.on('accessGranted', function() { window.location.reload(); });
} else {
	// Pull access token from storage
	relay1.setAccessToken(sessionStorage.getItem('access-token'));
	relay2.setAccessToken(sessionStorage.getItem('access-token'));
}

relay2.on('listening', function() {
	// Connect to self on second stream
	if (!peer1API) {
		relay1.connect(relay1.makeDomain(relay1.getUserId(), window.location.host, 1));
		// relay2.connect(relay2.getUserId()+'@grimwire.net!'+window.location.host+':0');
		// ^^^ uncomment to test leader-conflict resolution
	}
});

var peer1API;
var peer2API;
relay2.on('connected', function(data, server) {
	peer1API = local.agent(server.getUrl());
	checkReady();
});
relay1.on('connected', function(data, server) {
	peer2API = local.agent(server.getUrl());
	print(data.user);
	print(data.app);
	print(data.stream);
	print(data.domain);
	print(typeof server);
	checkReady();
});
function checkReady() {
	if (!peer1API || !peer2API)
		return;
	print('ready');
	finishTest();
}

var counter1 = 0;
function peer1ServerFn(req, res, peer) {
	if (req.path == '/' && req.method == 'GET') {
		res.writeHead(200, 'ok', { 'content-type': 'text/plain' });
		res.end(counter1++);
		return;
	}
	if (req.path == '/' && req.method == 'POST') {
		req.body_.then(function(body) {
			res.writeHead(200, 'ok', { 'content-type': 'text/plain' });
			res.end(body.toUpperCase());
		});
		return;
	}
	res.writeHead(404, 'not found').end();
}

var counter2 = 100;
function peer2ServerFn(req, res, peer) {
	if (req.path == '/' && req.method == 'GET') {
		res.writeHead(200, 'ok', { 'content-type': 'text/plain' });
		res.end(counter2--);
		return;
	}
	if (req.path == '/' && req.method == 'POST') {
		req.body_.then(function(body) {
			res.writeHead(200, 'ok', { 'content-type': 'text/plain' });
			res.end(body.toLowerCase());
		});
		return;
	}
	res.writeHead(404, 'not found').end();
}

wait(function () { return done; }, 15000);
/* =>
pfraze
dev.grimwire.com
1
pfraze@grimwire.net!dev.grimwire.com!1
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
			console.log(res.latency+' ms');
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
			console.log(res.latency+' ms');
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

// Test: 404 on bad target

done = false;
startTime = Date.now();
local.dispatch(relay1.makeDomain(relay1.getUserId(), window.location.host, 1337)).then(printErrorAndFinish, printSuccessAndFinish);
wait(function () { return done; });

/* =>
success
{body: "", headers: {}, reason: "not found", status: 404}
*/