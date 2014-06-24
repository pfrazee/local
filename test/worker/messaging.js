// load worker
web.spawnWorker('/test/worker/worker1.js');
// web.spawnWorker('/test/worker/worker2.js');

web.at('#hello', function(req, res, worker) {
    res.link({ href: '#' });
    res.s200().contentType('text').end('yes, hello '+req.params.foo+' '+req.params.bar);
});

web.at('pubweb-proxy', function(req, res, worker) {
	if (worker) {
		return res.s403('https is forbidden (even for '+req.params.url+' !)').end();
	}
	res.s204('I would let you, but I don\'t know you.').end();
});

// GET tests
done = false;
startTime = Date.now();
var responses_ = [];
for (var i = 0; i < 10; i++) {
	responses_.push(web.get('/test/worker/worker1.js#').end());
    responses_.push(web.get('/test/worker/worker2.js#').end());
}

responses_.always(function(responses) {
	responses.forEach(function(res, i) {
        if (i==0) print(res.links);
		print(res.status + ' ' + res.body);
		console.log(res.latency+' ms');
	});
	finishTest();
});
wait(function () { return done; });

/* =>
[{href: "http://localhost:8000/test/worker/worker1.js#"}]
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
	responses_.push(web.post('/test/worker/worker1.js#').end('FooBar'));
    responses_.push(web.post('/test/worker/worker2.js#').end('FooBar'));
}

web.promise.bundle(responses_)
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
    web.dispatch({ method: 'BOUNCE', url: '/test/worker/worker1.js#' }),
    web.dispatch({ method: 'BOUNCE', url: '/test/worker/worker2.js#' })
];

web.promise.bundle(responses_)
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
[{href: "http://localhost:8000/test/worker/worker1.js#"}]
200 yes, hello bob buzz
[{href: "http://localhost:8000/test/worker/worker2.js#"}]
*/

// importScripts() disabling test
done = false;
startTime = Date.now();
web.dispatch({ method: 'IMPORT', url: '/test/worker/worker1.js#' })
	.always(function(res) {
		print(res.status + ' ' + res.body);
		finishTest();
	});
wait(function () { return done; });

/* =>
200 TypeError: object is not a function
*/

// public-web endpoint test
done = false;
startTime = Date.now();
web.dispatch({ method: 'USEWEB', url: '/test/worker/worker1.js#' })
	.always(function(res) {
		print(res.status + ' ' + res.reason);
		finishTest();
	});
wait(function () { return done; });

/* =>
403 https is forbidden (even for https://grimwire.com?yes=no&foo=bar#baz !)
*/
