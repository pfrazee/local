// load worker
web.spawnWorker('/test/worker/worker1.js');
// web.spawnWorker('/test/worker/worker2.js');

web.export(hello);
hello.link(hello);
hello.ContentType('text');
function hello(req, res, worker) {
	return 'yes, hello '+req.params.foo+' '+req.params.bar;
}

web.export(pubweb_proxy);
function pubweb_proxy(req, res, worker) {
	if (worker) {
		throw web.Forbidden({ reason: 'https is forbidden (even for '+req.params.url+' !)' });
	}
	return 'I would let you, but I don\'t know you.';
}

// GET tests
done = false;
startTime = Date.now();
var responses_ = [];
for (var i = 0; i < 10; i++) {
	responses_.push(web.GET('/test/worker/worker1.js#'));
    responses_.push(web.GET('/test/worker/worker2.js#'));
}

responses_.always(function(responses) {
	responses.forEach(function(res, i) {
        if (i===0) print(res.links);
		print(res.status + ' ' + res.body);
		console.log(res.latency+' ms');
	});
	finishTest();
});
wait(function () { return done; });

/* =>
[{href: "http://dev.grimwire.com/test/worker/worker1.js#", rel: "self "}]
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
	responses_.push(web.POST('/test/worker/worker1.js#').ContentType('text').end('FooBar'));
    responses_.push(web.POST('/test/worker/worker2.js#').ContentType('text').end('FooBar'));
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
[{href: "http://dev.grimwire.com/test/worker/worker1.js#hello", rel: "self "}]
200 yes, hello bob buzz
[{href: "http://dev.grimwire.com/test/worker/worker2.js#hello", rel: "self "}]
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
403 https is forbidden (even for https://layer1.io?yes=no&foo=bar#baz !)
*/