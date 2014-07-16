// load worker
web.createServer(new Worker('/test/worker/worker1.js'), workerServer).listen({ local: 'worker1' });
web.createServer(new Worker('/test/worker/worker2.js'), workerServer).listen({ local: 'worker2' });
function workerServer(req, res) {
    res.link({ href: '/' });
    res.s200().contentType('text').end('yes, hello '+req.params.foo+' '+req.params.bar);
}

// GET tests
done = false;
startTime = Date.now();
var responses_ = [];
for (var i = 0; i < 10; i++) {
	responses_.push(web.get('local://worker1').end());
    responses_.push(web.get('local://worker2').end());
}

web.promise.bundle(responses_).always(function(responses) {
	responses.forEach(function(res, i) {
        if (i===0) print(res.links);
		print(res.status + ' ' + res.body);
		console.log(res.latency+' ms');
	});
	finishTest();
});
wait(function () { return done; });

/* =>
[{href: "local://worker1/"}]
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
	responses_.push(web.post('local://worker1').end('FooBar'));
    responses_.push(web.post('local://worker2').end('FooBar'));
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
    web.dispatch({ method: 'BOUNCE', url: 'local://worker1' }),
    web.dispatch({ method: 'BOUNCE', url: 'local://worker2' })
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
[{href: "local://parent/"}]
200 yes, hello bob buzz
[{href: "local://parent/"}]
*/
