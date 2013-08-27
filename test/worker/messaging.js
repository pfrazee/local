// load worker
local.workerBootstrapUrl = '../worker.js';
local.spawnWorkerServer('test/worker/worker1.js');
local.spawnWorkerServer('test/worker/worker2.js');

// GET tests
done = false;
startTime = Date.now();
var worker1API = local.navigator('httpl://worker1.js');
var worker2API = local.navigator('httpl://worker2.js');
var responses_ = [];
for (var i = 0; i < 10; i++) {
	responses_.push(worker1API.dispatch());
	responses_.push(worker2API.dispatch());
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

done = false;
startTime = Date.now();
var worker1API = local.navigator('httpl://worker1.js');
var worker2API = local.navigator('httpl://worker2.js');
var responses_ = [];
for (var i = 0; i < 10; i++) {
	responses_.push(worker1API.post('FooBar'));
	responses_.push(worker2API.post('FooBar'));
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