
done = false;
startTime = Date.now();

var pfrazeWeb = local.joinPeerWeb('//grimwire.net:8000', pfrazeServerFn, { app: 'testapp.grimwire.com' });
var bobWeb    = local.joinPeerWeb('//grimwire.net:8000', bobServerFn, { app: 'testapp.grimwire.com' });

pfrazeWeb.setAccessToken('pfraze:e6f2131a-e678-4f9c-8155-56918abfac1d');
bobWeb.setAccessToken('bob:aee615f1-04bc-417a-96c0-b409a0b6dd62 ');

pfrazeWeb.connect('bob', { app: 'testapp.grimwire.com' });

var pfrazeAPI;
var bobAPI;
bobWeb.on('connected', function(data) {
	pfrazeAPI = local.navigator(data.server.getUrl());
	checkReady();
});
pfrazeWeb.on('connected', function(data) {
	bobAPI = local.navigator(data.server.getUrl());
	print(data.user);
	print(data.app);
	print(data.domain);
	print(typeof data.server);
	checkReady();
});
function checkReady() {
	if (!pfrazeAPI || !bobAPI)
		return;
	print('ready');
	finishTest();
}

var counter1 = 0;
function pfrazeServerFn(req, res) {
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
function bobServerFn(req, res) {
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
bob
testapp.grimwire.com
testapp.grimwire.com_.bob_.grimwire.net.8000
object
ready
*/

// Test: GET traffic

done = false;
startTime = Date.now();
var responses_ = [];
for (var i = 0; i < 10; i++) {
	responses_.push(pfrazeAPI.dispatch());
	responses_.push(bobAPI.dispatch());
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
	responses_.push(pfrazeAPI.post('FooBar'));
	responses_.push(bobAPI.post('FooBar'));
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