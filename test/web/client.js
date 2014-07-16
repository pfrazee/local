// == SECTION client

var testRemote = web.head('http://grimwire.com:8080');

// remote server navigation

done = false;
startTime = Date.now();
var fooCollection = testRemote.get({ rel: 'collection', id: 'foo' });
fooCollection
  .then(printSuccess, printErrorAndFinish)
  .succeed(function(res) {
    fooCollection.get({ rel: 'item', id: 'baz' }).then(printSuccessAndFinish, printErrorAndFinish);
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
  .head({ rel: 'collection', id: 'foo' })
  .head({ rel: 'item', id: 'bar' })
  .head({ rel: 'up' })
  .head({ rel: 'via' })
  .head({ rel: 'self' })
  .get({ rel: 'collection', id: 'foo' })
  .then(printSuccessAndFinish, printErrorAndFinish);
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


var testLocal = web.head('local://main');

// document local server navigation

done = false;
startTime = Date.now();
testLocal.head({ rel: 'collection', id: 'foo' }).get()
  .then(printSuccess, printErrorAndFinish)
  .then(function(res) {
    testLocal.head({ rel: 'collection', id: 'foo' })
      .get({ rel: 'item', id: 'baz' })
      .then(printSuccessAndFinish, printErrorAndFinish);
  });
wait(function () { return done; });

/* =>
success
{
  ContentType: "application/json",
  Link: [
    {href: "local://main/", rel: "up via service"},
    {href: "local://main/foo", rel: "self current"},
    {href: "local://main/foo/{id}", rel: "item"}
  ],
  _buffer: "[\"bar\",\"baz\",\"blah\"]",
  body: ["bar", "baz", "blah"],
  links: [
    {href: "local://main/", rel: "up via service"},
    {href: "local://main/foo", rel: "self current"},
    {href: "local://main/foo/{id}", rel: "item"}
  ],
  reason: undefined,
  status: 200
}
success
{
  ContentType: "application/json",
  Link: [
    {href: "local://main/", rel: "via service"},
    {href: "local://main/foo", rel: "up collection index"},
    {href: "local://main/foo/baz", rel: "self current"},
    {href: "local://main/foo/bar", rel: "first"},
    {href: "local://main/foo/blah", rel: "last"},
    {href: "local://main/foo/bar", rel: "prev"},
    {href: "local://main/foo/blah", rel: "next"}
  ],
  _buffer: "\"baz\"",
  body: "baz",
  links: [
    {href: "local://main/", rel: "via service"},
    {href: "local://main/foo", rel: "up collection index"},
    {href: "local://main/foo/baz", rel: "self current"},
    {href: "local://main/foo/bar", rel: "first"},
    {href: "local://main/foo/blah", rel: "last"},
    {href: "local://main/foo/bar", rel: "prev"},
    {href: "local://main/foo/blah", rel: "next"}
  ],
  reason: undefined,
  status: 200
}
*/

// worker local server navigation

done = false;
startTime = Date.now();
web.head('local://worker').get({ rel: 'collection', id: 'foo' })
  .then(printSuccess, printErrorAndFinish)
  .then(function(res) {
     web.head('local://worker')
      .head({ rel: 'collection', id: 'foo'})
      .get({ rel: 'item', id: 'bazzzz' })
      .then(printSuccessAndFinish, printErrorAndFinish);
  });
wait(function () { return done; });

/* =>
success
{
  ContentType: "application/json",
  Link: [
    {href: "local://worker/", rel: "up via service"},
    {href: "local://worker/foo", rel: "self current"},
    {href: "local://worker/foo/{id}", rel: "item"}
  ],
  _buffer: "[\"bar\",\"bazzzz\",\"blah\"]",
  body: ["bar", "bazzzz", "blah"],
  links: [
    {href: "local://worker/", rel: "up via service"},
    {href: "local://worker/foo", rel: "self current"},
    {href: "local://worker/foo/{id}", rel: "item"}
  ],
  reason: undefined,
  status: 200
}
success
{
  ContentType: "application/json",
  Link: [
    {href: "local://worker/", rel: "via service"},
    {href: "local://worker/foo", rel: "up collection index"},
    {href: "local://worker/foo/bazzzz", rel: "self current"},
    {href: "local://worker/foo/bar", rel: "first"},
    {href: "local://worker/foo/blah", rel: "last"},
    {href: "local://worker/foo/bar", rel: "prev"},
    {href: "local://worker/foo/blah", rel: "next"}
  ],
  _buffer: "\"bazzzz\"",
  body: "bazzzz",
  links: [
    {href: "local://worker/", rel: "via service"},
    {href: "local://worker/foo", rel: "up collection index"},
    {href: "local://worker/foo/bazzzz", rel: "self current"},
    {href: "local://worker/foo/bar", rel: "first"},
    {href: "local://worker/foo/blah", rel: "last"},
    {href: "local://worker/foo/bar", rel: "prev"},
    {href: "local://worker/foo/blah", rel: "next"}
  ],
  reason: undefined,
  status: 200
}
*/

// mimetype dispatchers

done = false;
startTime = Date.now();
web.head('local://main').postJson({ rel: 'collection', id: 'foo' }, {foo: 'bar'})
  .then(printSuccess, printError)
  .always(function() {
    return web.head('local://main').head({ rel: 'collection', id: 'foo' }).postJson({ foo: 'bar' });
  })
  .then(printSuccess, printError)
  .always(finishTest);
wait(function () { return done; });

/* =>
success
{
  ContentType: "application/json",
  _buffer: {foo: "bar"},
  body: {foo: "bar"},
  links: [],
  reason: undefined,
  status: 200
}
success
{
  ContentType: "application/json",
  _buffer: {foo: "bar"},
  body: {foo: "bar"},
  links: [],
  reason: undefined,
  status: 200
}
*/