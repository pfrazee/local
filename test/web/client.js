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


var testLocal = web.head('#');

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
web.head('#worker').get({ rel: 'collection', id: 'foo' })
  .then(printSuccess, printErrorAndFinish)
  .then(function(res) {
     web.head('#worker')
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
    {href: "#worker", rel: "up via service"},
    {href: "#worker/foo", rel: "self current"},
    {href: "#worker/foo/{id}", rel: "item"}
  ],
  _buffer: "[\"bar\",\"bazzzz\",\"blah\"]",
  body: ["bar", "bazzzz", "blah"],
  links: [
    {href: "#worker", rel: "up via service"},
    {href: "#worker/foo", rel: "self current"},
    {href: "#worker/foo/{id}", rel: "item"}
  ],
  reason: undefined,
  status: 200
}
success
{
  ContentType: "application/json",
  Link: [
    {href: "#worker", rel: "via service"},
    {href: "#worker/foo", rel: "up collection index"},
    {href: "#worker/foo/bazzzz", rel: "self current"},
    {href: "#worker/foo/bar", rel: "first"},
    {href: "#worker/foo/blah", rel: "last"},
    {href: "#worker/foo/bar", rel: "prev"},
    {href: "#worker/foo/blah", rel: "next"}
  ],
  _buffer: "\"bazzzz\"",
  body: "bazzzz",
  links: [
    {href: "#worker", rel: "via service"},
    {href: "#worker/foo", rel: "up collection index"},
    {href: "#worker/foo/bazzzz", rel: "self current"},
    {href: "#worker/foo/bar", rel: "first"},
    {href: "#worker/foo/blah", rel: "last"},
    {href: "#worker/foo/bar", rel: "prev"},
    {href: "#worker/foo/blah", rel: "next"}
  ],
  reason: undefined,
  status: 200
}
*/

// mimetype dispatchers

done = false;
startTime = Date.now();
web.head('#').postJson({ rel: 'collection', id: 'foo' }, {foo: 'bar'})
  .then(printSuccess, printError)
  .always(function() {
    return web.head('#').head({ rel: 'collection', id: 'foo' }).postJson({ foo: 'bar' });
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