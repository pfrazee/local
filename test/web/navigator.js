// == SECTION navigator

var testServer = new local.web.Navigator('http://grimwire.com:8080');

// remote server navigation

done = false;
startTime = Date.now();
var fooCollection = testServer.collection('foo');
fooCollection.getJson()
  .then(printSuccess, printErrorAndFinish)
  .succeed(function(res) {
    fooCollection.item('baz').get().then(printSuccessAndFinish, printErrorAndFinish);
  });
wait(function () { return done; });

/* =>
success
{
  body: ["bar", "baz", "blah"],
  headers: {
    allow: "options, head, get",
    "content-type": "application/json",
    link: [
      {href: "/", rel: "up via service"},
      {href: "/foo", rel: "self current"},
      {href: "/foo/{id}", rel: "item"}
    ]
  },
  reason: "Ok",
  status: 200
}
success
{
  body: "baz",
  headers: {
    allow: "options, head, get",
    "content-type": "application/json",
    link: [
      {href: "/", rel: "via service"},
      {href: "/foo", rel: "up collection index"},
      {href: "/foo/baz", rel: "self current"},
      {href: "/foo/bar", rel: "first"},
      {href: "/foo/blah", rel: "last"},
      {href: "/foo/bar", rel: "prev"},
      {href: "/foo/blah", rel: "next"}
    ]
  },
  reason: "Ok",
  status: 200
}
*/

// complex remote server navigation

done = false;
startTime = Date.now();
testServer
  .collection('foo')
  .item('bar')
  .up()
  .via()
  .self()
  .collection('foo').get().then(printSuccessAndFinish, printErrorAndFinish);
wait(function () { return done; });

/* =>
success
{
  body: ["bar", "baz", "blah"],
  headers: {
    allow: "options, head, get",
    "content-type": "application/json",
    link: [
      {href: "/", rel: "up via service"},
      {href: "/foo", rel: "self current"},
      {href: "/foo/{id}", rel: "item"}
    ]
  },
  reason: "Ok",
  status: 200
}
*/

// local server navigation

done = false;
startTime = Date.now();
var testLocal = new local.web.Navigator('httpl://test.com');
testLocal.collection('foo').getJson()
  .then(printSuccess, printErrorAndFinish)
  .then(function(res) {
    testLocal.collection('foo').item('baz').get().then(printSuccessAndFinish, printErrorAndFinish);
  });
wait(function () { return done; });

/* =>
success
{
  body: ["bar", "baz", "blah"],
  headers: {
    "content-type": "application/json",
    link: [
      {href: "/", rel: "up via service"},
      {href: "/foo", rel: "self current"},
      {href: "/foo/{id}", rel: "item"}
    ]
  },
  reason: "ok",
  status: 200
}
success
{
  body: "baz",
  headers: {
    "content-type": "application/json",
    link: [
      {href: "/", rel: "via service"},
      {href: "/foo", rel: "up collection index"},
      {href: "/foo/baz", rel: "self current"},
      {href: "/foo/bar", rel: "first"},
      {href: "/foo/blah", rel: "last"},
      {href: "/foo/bar", rel: "prev"},
      {href: "/foo/blah", rel: "next"}
    ]
  },
  reason: "ok",
  status: 200
}
*/

// local streaming

done = false;
startTime = Date.now();
var testLocal = new local.web.Navigator('httpl://test.com');
testLocal.collection('foo').getJson(null, { stream:true })
  .succeed(printSuccess)
  .succeed(function(res) {
		print('---');
		res.on('data', function(payload) {
			print(payload);
			print(typeof payload);
		});
		res.on('end', function() {
      print('end conn');
    });
    res.on('close', function() {
			print('close conn');
			finishTest();
		});
	})
  .fail(printErrorAndFinish);
wait(function () { return done; });

/* =>
success
{
  body: "",
  headers: {
    "content-type": "application/json",
    link: [
      {href: "/", rel: "up via service"},
      {href: "/foo", rel: "self current"},
      {href: "/foo/{id}", rel: "item"}
    ]
  },
  reason: "ok",
  status: 200
}
---
[
string
"bar"
string
,"baz"
string
,"blah"
string
]
string
end conn
close conn
*/

// event stream subscribe

done = false;
startTime = Date.now();
var testLocal = new local.web.Navigator('httpl://test.com');
testLocal.collection('events').subscribe().then(
  function(stream) {
    stream.on('message', function(m) { print(m); });
    stream.on('foo', function(m) { print('foo', m.data); });
    stream.on('bar', function(m) { print('bar', m.data); });
    stream.on('close', function(e) {
      print('close');
      console.log(Date.now() - startTime, 'ms');
      done = true;
    });
  }, printErrorAndFinish);
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
close
*/