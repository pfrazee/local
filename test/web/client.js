// == SECTION client

var testRemote = new local.client('http://grimwire.com:8080');

// remote server navigation

done = false;
startTime = Date.now();
var fooCollection = testRemote.follow({ rel: 'collection', id: 'foo' });
fooCollection.GET()
  .then(printSuccess, printErrorAndFinish)
  .succeed(function(res) {
    fooCollection.follow({ rel: 'item', id: 'baz' }).GET().then(printSuccessAndFinish, printErrorAndFinish);
  });
wait(function () { return done; });

/* =>
success
{
  Allow: "OPTIONS, HEAD, GET, POST, SUBSCRIBE",
  ContentType: "application/json",
  Link: "</>; rel=\"up via service\", </foo>; rel=\"self current\", </foo/{id}>; rel=\"item\"",
  _buffer: "[\"bar\",\"baz\",\"blah\"]",
  body: ["bar", "baz", "blah"],
  links: [
    {href: "http://grimwire.com:8080/", rel: "up via service"},
    {href: "http://grimwire.com:8080/foo", rel: "self current"},
    {href: "http://grimwire.com:8080/foo/{id}", rel: "item"}
  ],
  reason: "Ok",
  status: 200
}
success
{
  Allow: "OPTIONS, HEAD, GET, SUBSCRIBE",
  ContentType: "application/json",
  Link: "</>; rel=\"via service\", </foo>; rel=\"up collection index\", </foo/baz>; rel=\"self current\", </foo/bar>; rel=\"first\", </foo/blah>; rel=\"last\", </foo/bar>; rel=\"prev\", </foo/blah>; rel=\"next\"",
  _buffer: "\"baz\"",
  body: "baz",
  links: [
    {href: "http://grimwire.com:8080/", rel: "via service"},
    {href: "http://grimwire.com:8080/foo", rel: "up collection index"},
    {href: "http://grimwire.com:8080/foo/baz", rel: "self current"},
    {href: "http://grimwire.com:8080/foo/bar", rel: "first"},
    {href: "http://grimwire.com:8080/foo/blah", rel: "last"},
    {href: "http://grimwire.com:8080/foo/bar", rel: "prev"},
    {href: "http://grimwire.com:8080/foo/blah", rel: "next"}
  ],
  reason: "Ok",
  status: 200
}
*/

// complex remote server navigation

done = false;
startTime = Date.now();
testRemote
  .follow({ rel: 'collection', id: 'foo' })
  .follow({ rel: 'item', id: 'bar' })
  .follow({ rel: 'up' })
  .follow('via')
  .self()
  .collection('foo')
  .GET().then(printSuccessAndFinish, printErrorAndFinish);
wait(function () { return done; });

/* =>
success
{
  Allow: "OPTIONS, HEAD, GET, POST, SUBSCRIBE",
  ContentType: "application/json",
  Link: "</>; rel=\"up via service\", </foo>; rel=\"self current\", </foo/{id}>; rel=\"item\"",
  _buffer: "[\"bar\",\"baz\",\"blah\"]",
  body: ["bar", "baz", "blah"],
  links: [
    {href: "http://grimwire.com:8080/", rel: "up via service"},
    {href: "http://grimwire.com:8080/foo", rel: "self current"},
    {href: "http://grimwire.com:8080/foo/{id}", rel: "item"}
  ],
  reason: "Ok",
  status: 200
}
*/


var testLocal = new local.client('#');

// document local server navigation

done = false;
startTime = Date.now();
testLocal.follow({ rel: 'collection', id: 'foo' }).GET()
  .then(printSuccess, printErrorAndFinish)
  .then(function(res) {
    testLocal.follow({ rel: 'collection', id: 'foo'})
      .follow({ rel: 'item', id: 'baz' })
      .GET().then(printSuccessAndFinish, printErrorAndFinish);
  });
wait(function () { return done; });

/* =>
success
{
  ContentType: "application/json",
  Link: [
    {href: "#", rel: "up via service"},
    {href: "#foo", rel: "self current"},
    {href: "#foo/{id}", rel: "item"}
  ],
  _buffer: "[\"bar\",\"baz\",\"blah\"]",
  body: ["bar", "baz", "blah"],
  links: [
    {href: "#", rel: "up via service"},
    {href: "#foo", rel: "self current"},
    {href: "#foo/{id}", rel: "item"}
  ],
  reason: undefined,
  status: 200
}
success
{
  ContentType: "application/json",
  Link: [
    {href: "#", rel: "via service"},
    {href: "#foo", rel: "up collection index"},
    {href: "#foo/baz", rel: "self current"},
    {href: "#foo/bar", rel: "first"},
    {href: "#foo/blah", rel: "last"},
    {href: "#foo/bar", rel: "prev"},
    {href: "#foo/blah", rel: "next"}
  ],
  _buffer: "\"baz\"",
  body: "baz",
  links: [
    {href: "#", rel: "via service"},
    {href: "#foo", rel: "up collection index"},
    {href: "#foo/baz", rel: "self current"},
    {href: "#foo/bar", rel: "first"},
    {href: "#foo/blah", rel: "last"},
    {href: "#foo/bar", rel: "prev"},
    {href: "#foo/blah", rel: "next"}
  ],
  reason: undefined,
  status: 200
}
*/

// worker local server navigation

done = false;
startTime = Date.now();
local.client('/test/web/_worker.js#').follow({ rel: 'collection', id: 'foo' }).GET()
  .then(printSuccess, printErrorAndFinish)
  .then(function(res) {
     local.client('/test/web/_worker.js#').follow({ rel: 'collection', id: 'foo'})
      .follow({ rel: 'item', id: 'bazzzz' })
      .GET().then(printSuccessAndFinish, printErrorAndFinish);
  });
wait(function () { return done; });

/* =>
success
{
  ContentType: "application/json",
  Link: [
    {href: "/test/web/_worker.js#", rel: "up via service"},
    {href: "/test/web/_worker.js#foo", rel: "self current"},
    {href: "/test/web/_worker.js#foo/{id}", rel: "item"}
  ],
  _buffer: "[\"bar\",\"bazzzz\",\"blah\"]",
  body: ["bar", "bazzzz", "blah"],
  links: [
    {href: "/test/web/_worker.js#", rel: "up via service"},
    {href: "/test/web/_worker.js#foo", rel: "self current"},
    {href: "/test/web/_worker.js#foo/{id}", rel: "item"}
  ],
  reason: undefined,
  status: 200
}
success
{
  ContentType: "application/json",
  Link: [
    {href: "/test/web/_worker.js#", rel: "via service"},
    {href: "/test/web/_worker.js#foo", rel: "up collection index"},
    {href: "/test/web/_worker.js#foo/bazzzz", rel: "self current"},
    {href: "/test/web/_worker.js#foo/bar", rel: "first"},
    {href: "/test/web/_worker.js#foo/blah", rel: "last"},
    {href: "/test/web/_worker.js#foo/bar", rel: "prev"},
    {href: "/test/web/_worker.js#foo/blah", rel: "next"}
  ],
  _buffer: "\"bazzzz\"",
  body: "bazzzz",
  links: [
    {href: "/test/web/_worker.js#", rel: "via service"},
    {href: "/test/web/_worker.js#foo", rel: "up collection index"},
    {href: "/test/web/_worker.js#foo/bazzzz", rel: "self current"},
    {href: "/test/web/_worker.js#foo/bar", rel: "first"},
    {href: "/test/web/_worker.js#foo/blah", rel: "last"},
    {href: "/test/web/_worker.js#foo/bar", rel: "prev"},
    {href: "/test/web/_worker.js#foo/blah", rel: "next"}
  ],
  reason: undefined,
  status: 200
}
*/

// rebase() and unresolve()

var testRebase = new local.client('#');
var testRebaseCollection = testRebase.follow({ rel: 'collection', id: 'foo' });
var testRebaseItem = testRebaseCollection.follow({ rel: 'item', id: 'bazzzz' });

done = false;
startTime = Date.now();
testRebaseCollection.GET()
  .then(printSuccess, printErrorAndFinish)
  .then(function() { return testRebaseItem.GET(); })
  .then(printSuccess, printErrorAndFinish)
  .then(function() {
    testRebase.rebase('/test/web/_worker.js#');
    testRebaseCollection.unresolve();
    testRebaseItem.unresolve();
    return testRebaseCollection.GET();
  })
  .then(printSuccess, printErrorAndFinish)
  .then(function() { return testRebaseItem.GET(); })
  .then(printSuccessAndFinish, printErrorAndFinish);
wait(function () { return done; });

/* =>
success
{
  ContentType: "application/json",
  Link: [
    {href: "#", rel: "up via service"},
    {href: "#foo", rel: "self current"},
    {href: "#foo/{id}", rel: "item"}
  ],
  _buffer: "[\"bar\",\"baz\",\"blah\"]",
  body: ["bar", "baz", "blah"],
  links: [
    {href: "#", rel: "up via service"},
    {href: "#foo", rel: "self current"},
    {href: "#foo/{id}", rel: "item"}
  ],
  reason: undefined,
  status: 200
}
error
{_buffer: "", body: "", links: [], reason: undefined, status: 404}
success
{
  ContentType: "application/json",
  Link: [
    {href: "/test/web/_worker.js#", rel: "up via service"},
    {href: "/test/web/_worker.js#foo", rel: "self current"},
    {href: "/test/web/_worker.js#foo/{id}", rel: "item"}
  ],
  _buffer: "[\"bar\",\"bazzzz\",\"blah\"]",
  body: ["bar", "bazzzz", "blah"],
  links: [
    {href: "/test/web/_worker.js#", rel: "up via service"},
    {href: "/test/web/_worker.js#foo", rel: "self current"},
    {href: "/test/web/_worker.js#foo/{id}", rel: "item"}
  ],
  reason: undefined,
  status: 200
}
success
{
  ContentType: "application/json",
  Link: [
    {href: "/test/web/_worker.js#", rel: "via service"},
    {href: "/test/web/_worker.js#foo", rel: "up collection index"},
    {href: "/test/web/_worker.js#foo/bazzzz", rel: "self current"},
    {href: "/test/web/_worker.js#foo/bar", rel: "first"},
    {href: "/test/web/_worker.js#foo/blah", rel: "last"},
    {href: "/test/web/_worker.js#foo/bar", rel: "prev"},
    {href: "/test/web/_worker.js#foo/blah", rel: "next"}
  ],
  _buffer: "\"bazzzz\"",
  body: "bazzzz",
  links: [
    {href: "/test/web/_worker.js#", rel: "via service"},
    {href: "/test/web/_worker.js#foo", rel: "up collection index"},
    {href: "/test/web/_worker.js#foo/bazzzz", rel: "self current"},
    {href: "/test/web/_worker.js#foo/bar", rel: "first"},
    {href: "/test/web/_worker.js#foo/blah", rel: "last"},
    {href: "/test/web/_worker.js#foo/bar", rel: "prev"},
    {href: "/test/web/_worker.js#foo/blah", rel: "next"}
  ],
  reason: undefined,
  status: 200
}
*/


// array of queries navigation

done = false;
startTime = Date.now();
local.client([
  '#',
  { rel: 'collection', id: 'foo' },
  { rel: 'item', id: 'baz' }
]).GET()
  .then(printSuccess, printErrorAndFinish)
  .then(function(res) {
    testLocal.follow([
      { rel: 'collection', id: 'foo'},
      { rel: 'item', id: 'baz' }
    ]).GET().then(printSuccessAndFinish, printErrorAndFinish);
  });
wait(function () { return done; });

/* =>
success
{
  ContentType: "application/json",
  Link: [
    {href: "#", rel: "via service"},
    {href: "#foo", rel: "up collection index"},
    {href: "#foo/baz", rel: "self current"},
    {href: "#foo/bar", rel: "first"},
    {href: "#foo/blah", rel: "last"},
    {href: "#foo/bar", rel: "prev"},
    {href: "#foo/blah", rel: "next"}
  ],
  _buffer: "\"baz\"",
  body: "baz",
  links: [
    {href: "#", rel: "via service"},
    {href: "#foo", rel: "up collection index"},
    {href: "#foo/baz", rel: "self current"},
    {href: "#foo/bar", rel: "first"},
    {href: "#foo/blah", rel: "last"},
    {href: "#foo/bar", rel: "prev"},
    {href: "#foo/blah", rel: "next"}
  ],
  reason: undefined,
  status: 200
}
success
{
  ContentType: "application/json",
  Link: [
    {href: "#", rel: "via service"},
    {href: "#foo", rel: "up collection index"},
    {href: "#foo/baz", rel: "self current"},
    {href: "#foo/bar", rel: "first"},
    {href: "#foo/blah", rel: "last"},
    {href: "#foo/bar", rel: "prev"},
    {href: "#foo/blah", rel: "next"}
  ],
  _buffer: "\"baz\"",
  body: "baz",
  links: [
    {href: "#", rel: "via service"},
    {href: "#foo", rel: "up collection index"},
    {href: "#foo/baz", rel: "self current"},
    {href: "#foo/bar", rel: "first"},
    {href: "#foo/blah", rel: "last"},
    {href: "#foo/bar", rel: "prev"},
    {href: "#foo/blah", rel: "next"}
  ],
  reason: undefined,
  status: 200
}
*/

// nav:|| navigation

done = false;
startTime = Date.now();
local.client('nav:||#|collection=foo|item=baz').GET()
  .then(printSuccess, printErrorAndFinish)
  .then(function(res) {
    testLocal.follow('|collection=foo|item=baz').GET().then(printSuccessAndFinish, printErrorAndFinish);
  });
wait(function () { return done; });

/* =>
success
{
  ContentType: "application/json",
  Link: [
    {href: "#", rel: "via service"},
    {href: "#foo", rel: "up collection index"},
    {href: "#foo/baz", rel: "self current"},
    {href: "#foo/bar", rel: "first"},
    {href: "#foo/blah", rel: "last"},
    {href: "#foo/bar", rel: "prev"},
    {href: "#foo/blah", rel: "next"}
  ],
  _buffer: "\"baz\"",
  body: "baz",
  links: [
    {href: "#", rel: "via service"},
    {href: "#foo", rel: "up collection index"},
    {href: "#foo/baz", rel: "self current"},
    {href: "#foo/bar", rel: "first"},
    {href: "#foo/blah", rel: "last"},
    {href: "#foo/bar", rel: "prev"},
    {href: "#foo/blah", rel: "next"}
  ],
  reason: undefined,
  status: 200
}
success
{
  ContentType: "application/json",
  Link: [
    {href: "#", rel: "via service"},
    {href: "#foo", rel: "up collection index"},
    {href: "#foo/baz", rel: "self current"},
    {href: "#foo/bar", rel: "first"},
    {href: "#foo/blah", rel: "last"},
    {href: "#foo/bar", rel: "prev"},
    {href: "#foo/blah", rel: "next"}
  ],
  _buffer: "\"baz\"",
  body: "baz",
  links: [
    {href: "#", rel: "via service"},
    {href: "#foo", rel: "up collection index"},
    {href: "#foo/baz", rel: "self current"},
    {href: "#foo/bar", rel: "first"},
    {href: "#foo/blah", rel: "last"},
    {href: "#foo/bar", rel: "prev"},
    {href: "#foo/blah", rel: "next"}
  ],
  reason: undefined,
  status: 200
}
*/

// local streaming

done = false;
startTime = Date.now();
testLocal.follow({ rel: 'collection', id: 'foo' }).GET()
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
  ContentType: "application/json",
  Link: [
    {href: "#", rel: "up via service"},
    {href: "#foo", rel: "self current"},
    {href: "#foo/{id}", rel: "item"}
  ],
  _buffer: "[\"bar\",\"baz\",\"blah\"]",
  body: ["bar", "baz", "blah"],
  links: [
    {href: "#", rel: "up via service"},
    {href: "#foo", rel: "self current"},
    {href: "#foo/{id}", rel: "item"}
  ],
  reason: undefined,
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
testLocal.follow({ rel: 'collection', id: 'events' }).subscribe().then(
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
{data: {c: 2}, event: "foo"}
{data: {c: 3}, event: "bar"}
foo {c: 1}
foo {c: 2}
bar {c: 3}
{data: {c: 4}, event: "foo"}
foo {c: 4}
{data: {c: 5}, event: "foo"}
foo {c: 5}
close
*/

done = false;
startTime = Date.now();
GET(from('#').collection('foo').item('baz'))
  .then(printSuccessAndFinish, printErrorAndFinish)
wait(function () { return done; });

/* =>
success
{
  ContentType: "application/json",
  Link: [
    {href: "#", rel: "via service"},
    {href: "#foo", rel: "up collection index"},
    {href: "#foo/baz", rel: "self current"},
    {href: "#foo/bar", rel: "first"},
    {href: "#foo/blah", rel: "last"},
    {href: "#foo/bar", rel: "prev"},
    {href: "#foo/blah", rel: "next"}
  ],
  _buffer: "\"baz\"",
  body: "baz",
  links: [
    {href: "#", rel: "via service"},
    {href: "#foo", rel: "up collection index"},
    {href: "#foo/baz", rel: "self current"},
    {href: "#foo/bar", rel: "first"},
    {href: "#foo/blah", rel: "last"},
    {href: "#foo/bar", rel: "prev"},
    {href: "#foo/blah", rel: "next"}
  ],
  reason: undefined,
  status: 200
}
*/