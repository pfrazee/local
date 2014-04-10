// == SECTION agent

var testRemote = new local.agent('http://grimwire.com:8080');

// remote server navigation

done = false;
startTime = Date.now();
var fooCollection = testRemote.follow({ rel: 'collection', id: 'foo' });
fooCollection.get()
  .then(printSuccess, printErrorAndFinish)
  .succeed(function(res) {
    fooCollection.follow({ rel: 'item', id: 'baz' }).get().then(printSuccessAndFinish, printErrorAndFinish);
  });
wait(function () { return done; });

/* =>
success
{
  body: ["bar", "baz", "blah"],
  headers: {
    allow: "OPTIONS, HEAD, GET, POST, SUBSCRIBE",
    "content-type": "application/json",
    link: "</>; rel=\"up via service\", </foo>; rel=\"self current\", </foo/{id}>; rel=\"item\""
  },
  reason: "Ok",
  status: 200
}
success
{
  body: "baz",
  headers: {
    allow: "OPTIONS, HEAD, GET, SUBSCRIBE",
    "content-type": "application/json",
    link: "</>; rel=\"via service\", </foo>; rel=\"up collection index\", </foo/baz>; rel=\"self current\", </foo/bar>; rel=\"first\", </foo/blah>; rel=\"last\", </foo/bar>; rel=\"prev\", </foo/blah>; rel=\"next\""
  },
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
  .follow({ rel: 'via' })
  .follow({ rel: 'self' })
  .follow({ rel: 'collection', id: 'foo' })
  .get().then(printSuccessAndFinish, printErrorAndFinish);
wait(function () { return done; });

/* =>
success
{
  body: ["bar", "baz", "blah"],
  headers: {
    allow: "OPTIONS, HEAD, GET, POST, SUBSCRIBE",
    "content-type": "application/json",
    link: "</>; rel=\"up via service\", </foo>; rel=\"self current\", </foo/{id}>; rel=\"item\""
  },
  reason: "Ok",
  status: 200
}
*/


var testLocal = new local.agent('local://test.com');

// document local server navigation

done = false;
startTime = Date.now();
testLocal.follow({ rel: 'collection', id: 'foo' }).get()
  .then(printSuccess, printErrorAndFinish)
  .then(function(res) {
    testLocal.follow({ rel: 'collection', id: 'foo'})
      .follow({ rel: 'item', id: 'baz' })
      .get().then(printSuccessAndFinish, printErrorAndFinish);
  });
wait(function () { return done; });

/* =>
success
{
  body: ["bar", "baz", "blah"],
  headers: {
    "content-type": "application/json",
    link: "</>; rel=\"up via service\", </foo>; rel=\"self current\", </foo/{id}>; rel=\"item\""
  },
  reason: "ok",
  status: 200
}
success
{
  body: "baz",
  headers: {
    "content-type": "application/json",
    link: "</>; rel=\"via service\", </foo>; rel=\"up collection index\", </foo/baz>; rel=\"self current\", </foo/bar>; rel=\"first\", </foo/blah>; rel=\"last\", </foo/bar>; rel=\"prev\", </foo/blah>; rel=\"next\""
  },
  reason: "ok",
  status: 200
}
*/

// worker local server navigation

done = false;
startTime = Date.now();
local.agent('local://dev.grimwire.com(test/web/_worker.js)').follow({ rel: 'collection', id: 'foo' }).get()
  .then(printSuccess, printErrorAndFinish)
  .then(function(res) {
    local.agent('local://dev.grimwire.com(test/web/_worker.js)').follow({ rel: 'collection', id: 'foo'})
      .follow({ rel: 'item', id: 'baz' })
      .get().then(printSuccessAndFinish, printErrorAndFinish);
  });
wait(function () { return done; });

/* =>
success
{
  body: ["bar", "baz", "blah"],
  headers: {
    "content-type": "application/json",
    link: "</>; rel=\"up via service\", </foo>; rel=\"self current\", </foo/{id}>; rel=\"item\""
  },
  reason: "ok",
  status: 200
}
success
{
  body: "baz",
  headers: {
    "content-type": "application/json",
    link: "</>; rel=\"via service\", </foo>; rel=\"up collection index\", </foo/baz>; rel=\"self current\", </foo/bar>; rel=\"first\", </foo/blah>; rel=\"last\", </foo/bar>; rel=\"prev\", </foo/blah>; rel=\"next\""
  },
  reason: "ok",
  status: 200
}
*/

// rebase() and unresolve()

var testRebase = new local.agent('local://test.com');
var testRebaseCollection = testRebase.follow({ rel: 'collection', id: 'foo' });
var testRebaseItem = testRebaseCollection.follow({ rel: 'item', id: 'baz' });

done = false;
startTime = Date.now();
testRebaseCollection.get()
  .then(printSuccess, printErrorAndFinish)
  .then(function() { return testRebaseItem.get(); })
  .then(printSuccess, printErrorAndFinish)
  .then(function() {
    testRebase.rebase('local://dev.grimwire.com(test/web/_worker.js)');
    testRebaseCollection.unresolve();
    testRebaseItem.unresolve();
    return testRebaseCollection.get();
  })
  .then(printSuccess, printErrorAndFinish)
  .then(function() { return testRebaseItem.get(); })
  .then(printSuccessAndFinish, printErrorAndFinish);
wait(function () { return done; });

/* =>
success
{
  body: ["bar", "baz", "blah"],
  headers: {
    "content-type": "application/json",
    link: "</>; rel=\"up via service\", </foo>; rel=\"self current\", </foo/{id}>; rel=\"item\""
  },
  reason: "ok",
  status: 200
}
success
{
  body: "baz",
  headers: {
    "content-type": "application/json",
    link: "</>; rel=\"via service\", </foo>; rel=\"up collection index\", </foo/baz>; rel=\"self current\", </foo/bar>; rel=\"first\", </foo/blah>; rel=\"last\", </foo/bar>; rel=\"prev\", </foo/blah>; rel=\"next\""
  },
  reason: "ok",
  status: 200
}
success
{
  body: ["bar", "baz", "blah"],
  headers: {
    "content-type": "application/json",
    link: "</>; rel=\"up via service\", </foo>; rel=\"self current\", </foo/{id}>; rel=\"item\""
  },
  reason: "ok",
  status: 200
}
success
{
  body: "baz",
  headers: {
    "content-type": "application/json",
    link: "</>; rel=\"via service\", </foo>; rel=\"up collection index\", </foo/baz>; rel=\"self current\", </foo/bar>; rel=\"first\", </foo/blah>; rel=\"last\", </foo/bar>; rel=\"prev\", </foo/blah>; rel=\"next\""
  },
  reason: "ok",
  status: 200
}
*/


// array of queries navigation

done = false;
startTime = Date.now();
local.agent([
  'local://test.com',
  { rel: 'collection', id: 'foo' },
  { rel: 'item', id: 'baz' }
]).get()
  .then(printSuccess, printErrorAndFinish)
  .then(function(res) {
    testLocal.follow([
      { rel: 'collection', id: 'foo'},
      { rel: 'item', id: 'baz' }
    ]).get().then(printSuccessAndFinish, printErrorAndFinish);
  });
wait(function () { return done; });

/* =>
success
{
  body: "baz",
  headers: {
    "content-type": "application/json",
    link: "</>; rel=\"via service\", </foo>; rel=\"up collection index\", </foo/baz>; rel=\"self current\", </foo/bar>; rel=\"first\", </foo/blah>; rel=\"last\", </foo/bar>; rel=\"prev\", </foo/blah>; rel=\"next\""
  },
  reason: "ok",
  status: 200
}
success
{
  body: "baz",
  headers: {
    "content-type": "application/json",
    link: "</>; rel=\"via service\", </foo>; rel=\"up collection index\", </foo/baz>; rel=\"self current\", </foo/bar>; rel=\"first\", </foo/blah>; rel=\"last\", </foo/bar>; rel=\"prev\", </foo/blah>; rel=\"next\""
  },
  reason: "ok",
  status: 200
}
*/

// nav:|| navigation

done = false;
startTime = Date.now();
local.agent('nav:||local://test.com|collection=foo|item=baz').get()
  .then(printSuccess, printErrorAndFinish)
  .then(function(res) {
    testLocal.follow('|collection=foo|item=baz').get().then(printSuccessAndFinish, printErrorAndFinish);
  });
wait(function () { return done; });

/* =>
success
{
  body: "baz",
  headers: {
    "content-type": "application/json",
    link: "</>; rel=\"via service\", </foo>; rel=\"up collection index\", </foo/baz>; rel=\"self current\", </foo/bar>; rel=\"first\", </foo/blah>; rel=\"last\", </foo/bar>; rel=\"prev\", </foo/blah>; rel=\"next\""
  },
  reason: "ok",
  status: 200
}
success
{
  body: "baz",
  headers: {
    "content-type": "application/json",
    link: "</>; rel=\"via service\", </foo>; rel=\"up collection index\", </foo/baz>; rel=\"self current\", </foo/bar>; rel=\"first\", </foo/blah>; rel=\"last\", </foo/bar>; rel=\"prev\", </foo/blah>; rel=\"next\""
  },
  reason: "ok",
  status: 200
}
*/

// local streaming

done = false;
startTime = Date.now();
testLocal.follow({ rel: 'collection', id: 'foo' }).get({ stream: true })
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
    link: "</>; rel=\"up via service\", </foo>; rel=\"self current\", </foo/{id}>; rel=\"item\""
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

// local request streaming after async follow()s

done = false;
startTime = Date.now();
testLocal.unresolve();
var req = new local.Request({ method: 'POST', headers: { 'content-type': 'application/json' } });
var res_ = testLocal.follow({ rel: 'collection', id: 'foo' }).dispatch(req);
req.end({ foo: 'bar' });
res_.then(printSuccessAndFinish, printErrorAndFinish);
wait(function () { return done; });

/* =>
success
{
  body: {foo: "bar"},
  headers: {"content-type": "application/json"},
  reason: "ok",
  status: 200
}
*/

// remote request streaming after async follow()s

done = false;
startTime = Date.now();
testRemote.unresolve();
var req = new local.Request({ method: 'POST', headers: { 'content-type': 'application/json' } });
var res_ = testRemote.follow({ rel: 'collection', id: 'foo' }).dispatch(req);
req.end({ foo: 'bar' });
res_.then(printSuccessAndFinish, printErrorAndFinish);
wait(function () { return done; });

/* =>
success
{
  body: "{\"foo\":\"bar\"}",
  headers: {
    allow: "OPTIONS, HEAD, GET, POST, SUBSCRIBE",
    "content-type": "application/json",
    link: "</>; rel=\"up via service\", </foo>; rel=\"self current\", </foo/{id}>; rel=\"item\""
  },
  reason: "Ok",
  status: 200
}
*/