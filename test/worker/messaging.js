// load worker
local.spawnWorker('/test/worker/worker1.js');
// local.spawnWorker('/test/worker/worker2.js');

local.at('#hello', function(req, res, worker) {
    console.log(worker);
    res.Link({ href: '#' });
    res.s200().ContentType('text').end('yes, hello '+req.params.foo+' '+req.params.bar);
});

local.at('#worker1.js/?(.*)', function(req, res, worker) {
    console.log(worker);
    var req2 = local.dispatch({ method: req.method, url: '/test/worker/worker2.js#'+req.pathd[1] });
    req.pipe(req2);
    req2.pipe(res);
});

local.at('#worker2.js/?(.*)', function(req, res, worker) {
    console.log(worker);
    var req2 = local.dispatch({ method: req.method, url: '/test/worker/worker2.js#'+req.pathd[1] });
    req.pipe(req2);
    req2.pipe(res);
});

// GET tests
done = false;
startTime = Date.now();
var responses_ = [];
for (var i = 0; i < 10; i++) {
	responses_.push(GET('/test/worker/worker1.js#').end());
    responses_.push(GET('/test/worker/worker2.js#').end());
}

local.promise.bundle(responses_)
	.always(function(responses) {
		responses.forEach(function(res, i) {
            if (i==0) print(res.links);
			print(res.status + ' ' + res.body);
			console.log(res.latency+' ms');
		});
		finishTest();
	});
wait(function () { return done; });

/* =>
[{href: "http://test/worker/worker1.js/#"}]
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
var responses_ = [];
for (var i = 0; i < 10; i++) {
	responses_.push(POST('/test/worker/worker1.js#').end('FooBar'));
    responses_.push(POST('/test/worker/worker2.js#').end('FooBar'));
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
var responses_ = [
    local.dispatch({ method: 'BOUNCE', url: '/test/worker/worker1.js#' }),
    local.dispatch({ method: 'BOUNCE', url: '/test/worker/worker2.js#' })
];

local.promise.bundle(responses_)
	.always(function(responses) {
		responses.forEach(function(res) {
			print(res.status + ' ' + res.body);
            print(res.Link);
			console.log(res.latency+' ms');
		});
		finishTest();
	});
wait(function () { return done; });

/* =>
200 yes, hello alice bazz
{href: "http://dev.grimwire.com/test/worker/worker1.js/#"}
200 yes, hello bob buzz
{href: "http://dev.grimwire.com/test/worker/worker2.js/#"}
*/

// importScripts() disabling test
done = false;
startTime = Date.now();
local.dispatch({ method: 'IMPORT', url: '/test/worker/worker1.js#' })
	.always(function(res) {
		print(res.status + ' ' + res.body);
		finishTest();
	});
wait(function () { return done; });

/* =>
200 Local.js - Imports disabled after initial load to prevent data-leaking
*/