
// == SECTION events

// document local event server

done = false;
startTime = Date.now();
var stream = web.subscribe('#events');
stream.on('foo', function(m) { print('foo', m.data); });
stream.on('bar', function(m) { print('bar', m.data); });
stream.on('close', function(e) {
	print('close');
	console.log(Date.now() - startTime, 'ms');
	done = true;
});
wait(function () { return done; });

/* =>
foo {c: 1}
foo {c: 2}
bar {c: 3}
foo {c: 4}
foo {c: 5}
close
*/

// worker local event server

done = false;
startTime = Date.now();
var stream = web.subscribe('dev.grimwire.com/test/web/_worker.js#events');
stream.on('foo', function(m) { print('foo', m.data); });
stream.on('bar', function(m) { print('bar', m.data); });
stream.on('close', function(e) {
	print('close');
	console.log(Date.now() - startTime, 'ms');
	done = true;
});
wait(function () { return done; });

/* =>
foo {c: 1}
foo {c: 2}
bar {c: 3}
foo {c: 4}
foo {c: 5}
close
*/

// remote event server

done = false;
startTime = Date.now();
var stream2 = web.subscribe('http://grimwire.com:8080/events');
stream2.on('foo', function(m) { print('foo', m.data); });
stream2.on('bar', function(m) { print('bar', m.data); });
stream2.on('close', function(e) {
	print('close');
	console.log(Date.now() - startTime, 'ms');
	done = true;
});
wait(function () { return done; });

/* =>
foo {c: 1}
foo {c: 2}
bar {c: 3}
foo {c: 4}
foo {c: 5}
close
*/