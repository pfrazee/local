
// == SECTION events

// local event server

done = false;
startTime = Date.now();
var stream = Link.subscribe({ url:'httpl://test.com/events' });
stream.on('message', function(m) { print(m); });
stream.on('foo', function(m) { print('foo', m.data); });
stream.on('bar', function(m) { print('bar', m.data); });
stream.on('error', function(e) {
	print('close', e);
	console.log(Date.now() - startTime, 'ms');
	done = true;
});
wait(function () { return done; });

/* =>
{data: {c: 1}, event: "foo"}
foo {c: 1}
{data: {c: 2}, event: "foo"}
foo {c: 2}
{data: {c: 3}, event: "bar"}
bar {c: 3}
{data: {c: 4}, event: "foo"}
foo {c: 4}
{data: {c: 5}, event: "foo"}
foo {c: 5}
{data: undefined, event: "error"}
close {data: undefined, event: "error"}
*/

// remote event server

done = false;
startTime = Date.now();
var stream2 = Link.subscribe({ url:'http://linkapjs.com:8080/events' });
stream2.on('message', function(m) { print(m); });
stream2.on('foo', function(m) { print('foo', m.data); });
stream2.on('bar', function(m) { print('bar', m.data); });
stream2.on('error', function(e) {
	print('close', e);
	console.log(Date.now() - startTime, 'ms');
	done = true;
});
wait(function () { return done; });

/* =>
{data: {c: 1}, event: "foo"}
foo {c: 1}
{data: {c: 2}, event: "foo"}
foo {c: 2}
{data: {c: 3}, event: "bar"}
bar {c: 3}
{data: {c: 4}, event: "foo"}
foo {c: 4}
{data: {c: 5}, event: "foo"}
foo {c: 5}
{data: undefined, event: "error"}
close {data: undefined, event: "error"}
*/