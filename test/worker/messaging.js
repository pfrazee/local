// load worker
local.spawnWorkerServer('worker/worker1.js', { myname: 'alice' }, function(req, res, me) {
	print(me.config.domain);
	res.writeHead(200, 'ok', { 'content-type': 'text/plain' }).end('yes, hello '+req.query.foo+' '+req.query.bar);
});
local.spawnWorkerServer('worker/worker2.js', { myname: 'bob' }, function(req, res, me) {
	print(me.config.domain);
	res.writeHead(200, 'ok', { 'content-type': 'text/plain' }).end('no, bye '+req.query.foo+' '+req.query.bar);
});

// GET tests
done = false;
startTime = Date.now();
var worker1API = local.agent('httpl://worker1.js');
var worker2API = local.agent('httpl://worker2.js');
var responses_ = [];
for (var i = 0; i < 10; i++) {
	responses_.push(worker1API.dispatch());
	responses_.push(worker2API.dispatch());
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

done = false;
startTime = Date.now();
var worker1API = local.agent('httpl://worker1.js');
var worker2API = local.agent('httpl://worker2.js');
var responses_ = [];
for (var i = 0; i < 10; i++) {
	responses_.push(worker1API.post('FooBar'));
	responses_.push(worker2API.post('FooBar'));
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

done = false;
startTime = Date.now();
var worker1API = local.agent('httpl://worker1.js');
var worker2API = local.agent('httpl://worker2.js');
var responses_ = [
	worker1API.dispatch({ method: 'bounce' }),
	worker2API.dispatch({ method: 'bounce' })
];

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
worker1.js
worker2.js
yes, hello alice bazz
no, bye bob buzz
*/