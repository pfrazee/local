// load worker
local.spawnWorkerServer('/test/worker/worker1.js', { myname: 'alice' }, function(req, res, me) {
	console.log(me.config.domain);
	res.writeHead(200, 'ok', { 'content-type': 'text/plain' }).end('yes, hello '+req.query.foo+' '+req.query.bar);
});
local.spawnWorkerServer('/test/worker/worker2.js', { myname: 'bob' }, function(req, res, me) {
	console.log(me.config.domain);
	res.writeHead(200, 'ok', { 'content-type': 'text/plain' }).end('no, bye '+req.query.foo+' '+req.query.bar);
});

// GET tests
done = false;
startTime = Date.now();
var worker1API = local.agent('httpl://dev.grimwire.com[test/worker/worker1.js]');
var worker2API = local.agent('httpl://dev.grimwire.com[test/worker/worker2.js]');
var responses_ = [];
for (var i = 0; i < 10; i++) {
	responses_.push(worker1API.dispatch());
	responses_.push(worker2API.dispatch());
}

local.promise.bundle(responses_)
	.always(function(responses) {
		responses.forEach(function(res) {
			print(res.status + ' ' + res.body);
			console.log(res.latency+' ms');
		});
		finishTest();
	});
wait(function () { return done; });

/* =>
200 0
200 100
200 1
200 99
200 2
200 98
200 3
200 97
200 4
200 96
200 5
200 95
200 6
200 94
200 7
200 93
200 8
200 92
200 9
200 91
*/

done = false;
startTime = Date.now();
var worker1API = local.agent('httpl://dev.grimwire.com[test/worker/worker1.js]');
var worker2API = local.agent('httpl://dev.grimwire.com[test/worker/worker2.js]');
var responses_ = [];
for (var i = 0; i < 10; i++) {
	responses_.push(worker1API.post('FooBar'));
	responses_.push(worker2API.post('FooBar'));
}

local.promise.bundle(responses_)
	.always(function(responses) {
		responses.forEach(function(res) {
			print(res.status + ' ' + res.body);
			console.log(res.latency+' ms');
		});
		finishTest();
	});
wait(function () { return done; });

/* =>
200 FOOBAR
200 foobar
200 FOOBAR
200 foobar
200 FOOBAR
200 foobar
200 FOOBAR
200 foobar
200 FOOBAR
200 foobar
200 FOOBAR
200 foobar
200 FOOBAR
200 foobar
200 FOOBAR
200 foobar
200 FOOBAR
200 foobar
200 FOOBAR
200 foobar
*/

done = false;
startTime = Date.now();
var worker1API = local.agent('httpl://dev.grimwire.com[test/worker/worker1.js]');
var worker2API = local.agent('httpl://dev.grimwire.com[test/worker/worker2.js]');
var responses_ = [
	worker1API.dispatch({ method: 'bounce' }),
	worker2API.dispatch({ method: 'bounce' })
];

local.promise.bundle(responses_)
	.always(function(responses) {
		responses.forEach(function(res) {
			print(res.status + ' ' + res.body);
			console.log(res.latency+' ms');
		});
		finishTest();
	});
wait(function () { return done; });

/* =>
200 yes, hello alice bazz
200 no, bye bob buzz
*/