// == SECTION core - remote requests

// successful remote requests

done = false;
startTime = Date.now();
GET('http://grimwire.com:8080')
  .Accept('json')
  .then(printSuccess, printError)
  .always(finishTest);
wait(function () { return done; });

/* =>
success
{
  Allow: "OPTIONS, HEAD, GET, SUBSCRIBE",
  ContentType: "application/json",
  Link: "</>; rel=\"self current\", </foo>; rel=\"collection\"; id=\"foo\", </{id}>; rel=\"collection\"",
  _buffer: "{\"hello\":\"world\"}",
  body: {hello: "world"},
  links: [
    {href: "http://grimwire.com:8080/", rel: "self current"},
    {href: "http://grimwire.com:8080/foo", id: "foo", rel: "collection"},
    {href: "http://grimwire.com:8080/{id}", rel: "collection"}
  ],
  reason: "Ok",
  status: 200
}
*/

// unsuccessful remote requests

done = false;
startTime = Date.now();
GET('http://grimwire.com:8080/bad/url').then(printSuccess, printError).always(finishTest);
wait(function () { return done; });

/* =>
error
{
  Allow: "OPTIONS, HEAD, GET, SUBSCRIBE",
  _buffer: "",
  body: "",
  reason: "Not Found",
  status: 404
}
*/

// aborted remote requests

done = false;
startTime = Date.now();
var request = GET('http://grimwire.com:8080').Accept('json').start();
request.then(printSuccess, printError).always(finishTest);
request.close();
wait(function () { return done; });
/* => error
{_buffer: "", body: null, reason: null, status: 0}
*/

// == SECTION core - document virtual requests

// successful virtual requests

done = false;
startTime = Date.now();
GET('#').then(printSuccess, printError).always(finishTest);
wait(function () { return done; });

/* =>
success
{
  ContentType: "text/plain",
  Link: [
    {
      href: "#",
      rel: "self current http://grimwire.com/rel/test grimwire.com/rel/test grimwire.com"
    },
    {href: "#events", id: "events", rel: "collection"},
    {href: "#foo", id: "foo", rel: "collection"},
    {href: "#{id}", rel: "collection"}
  ],
  _buffer: "service resource",
  body: "service resource",
  links: [
    {
      href: "#",
      rel: "self current http://grimwire.com/rel/test grimwire.com/rel/test grimwire.com"
    },
    {href: "#events", id: "events", rel: "collection"},
    {href: "#foo", id: "foo", rel: "collection"},
    {href: "#{id}", rel: "collection"}
  ],
  reason: undefined,
  status: 200
}
*/

// streamed virtual responses

done = false;
startTime = Date.now();
GET('#')
  .bufferResponse(false)
  .then(function(res) {
    print('success');
    res.on('data', print);
    res.on('end', finishTest);
  }, printErrorAndFinish);
wait(function () { return done; });

/* =>
success
service resource
*/

// unsuccessful virtual requests

done = false;
startTime = Date.now();
GET('#bad/url').then(printSuccess, printError).always(finishTest);
wait(function () { return done; });

/* =>
error
{_buffer: "", body: "", reason: undefined, status: 404}
*/

// successful virtual posts

done = false;
startTime = Date.now();
POST('#foo')
  .ContentType('plain')
  .end('echo this, please')
  .then(printSuccess, printError)
  .always(finishTest);
wait(function () { return done; });

/* =>
success
{
  ContentType: "text/plain",
  _buffer: "echo this, please",
  body: "echo this, please",
  reason: undefined,
  status: 200
}
*/

// streamed virtual post and streamed response

done = false;
startTime = Date.now();
var req = new local.Request({ method: 'POST', url: '#foo', ContentType: 'plain' });
req.write('echo this,');
req.write(' also');
req.end();
req.then(function(res) {
  print('success');
  res.on('data', print);
  res.on('end', finishTest);
}, printErrorAndFinish);
wait(function () { return done; });

/* =>
success
echo this,
 also
*/

// header keyname consistency check

done = false;
startTime = Date.now();
GET('#headers-echo')
  .header('content-type', 'ContentType')
  .header('fooBar', 'FooBar')
  .header('Asdf-fdsa', 'AsdfFdsa')
  .header('contentMD5', 'ContentMD5')
  .then(printSuccess, printError)
  .always(finishTest);
wait(function () { return done; });

/* =>
success
{
  AsdfFdsa: "AsdfFdsa",
  ContentMD5: "ContentMD5",
  ContentType: "ContentType",
  FooBar: "FooBar",
  _buffer: "",
  body: "",
  reason: undefined,
  status: 204
}
*/

// mimetype aliases

done = false;
startTime = Date.now();
POST('#mimetype-alises-echo')
  .Accept('html')
  .ContentType('csv')
  .end('foo,bar')
  .then(printSuccess, printError)
  .always(finishTest);
wait(function () { return done; });

/* =>
success
{
  _buffer: "<strong>foo,bar</strong>",
  body: "<strong>foo,bar</strong>",
  reason: undefined,
  status: 200
}
*/

// mimetype enforcement

done = false;
startTime = Date.now();
POST('#mimetype-alises-echo')
  .Accept('json')
  .ContentType('csv')
  .end('foo,bar')
  .then(printSuccess, printError)
  .always(function() {
    return POST('#mimetype-alises-echo')
      .Accept('html')
      .ContentType('text/plain');
  })
  .then(printSuccess, printError)
  .always(finishTest);
wait(function () { return done; });

/* =>
error
{_buffer: "", body: "", reason: "can only provide html", status: 406}
error
{_buffer: "", body: "", reason: "only understands text/csv", status: 415}
*/

// virtual poundsign optional

done = false;
startTime = Date.now();
GET('#pound-sign-optional')
  .then(printSuccess, printError)
  .always(finishTest);
wait(function () { return done; });

/* =>
success
{_buffer: "", body: "", reason: undefined, status: 204}
*/

// virtual body parsing

done = false;
startTime = Date.now();
POST('#parse-body')
  .ContentType('json')
  .end(JSON.stringify({foo:"bar"}))
  .then(printSuccess, printError)
  .always(function() {
    return POST('#parse-body')
      .ContentType('urlencoded')
      .end('foo2=bar2');
  })
  .then(printSuccess, printError)
  .always(finishTest);
wait(function () { return done; });

/* =>
success
{_buffer: {foo: "bar"}, body: {foo: "bar"}, reason: undefined, status: 200}
success
{_buffer: {foo2: "bar2"}, body: {foo2: "bar2"}, reason: undefined, status: 200}
*/

// virtual query parameters

done = false;
startTime = Date.now();
GET('#query-params', { thunder: 'flash' })
  .param('yeah', 'buddy')
  .param({ itsa: 'me', number: 5 })
  .then(printSuccess, printError)
  .always(finishTest);
wait(function () { return done; });

/* =>
success
{
  ContentType: "application/json",
  _buffer: {itsa: "me", number: 5, thunder: "flash", yeah: "buddy"},
  body: {itsa: "me", number: 5, thunder: "flash", yeah: "buddy"},
  reason: undefined,
  status: 200
}
*/

// virtual piping

done = false;
startTime = Date.now();
GET('#pipe', { src: '#' })
  .then(printSuccess, printError)
  .always(function() {
    return POST('#pipe')
      .end('and also pipe this');
  })
  .then(printSuccess, printError)
  .always(finishTest);
wait(function () { return done; });
/* =>
success
{
  ContentType: "text/piped+plain",
  Link: [
    {
      href: "#",
      rel: "self current http://grimwire.com/rel/test grimwire.com/rel/test grimwire.com"
    },
    {href: "#events", id: "events", rel: "collection"},
    {href: "#foo", id: "foo", rel: "collection"},
    {href: "#{id}", rel: "collection"}
  ],
  _buffer: "SERVICE RESOURCE",
  body: "SERVICE RESOURCE",
  links: [
    {
      href: "#",
      rel: "self current http://grimwire.com/rel/test grimwire.com/rel/test grimwire.com"
    },
    {href: "#events", id: "events", rel: "collection"},
    {href: "#foo", id: "foo", rel: "collection"},
    {href: "#{id}", rel: "collection"}
  ],
  reason: undefined,
  status: 200
}
success
{
  _buffer: "AND ALSO PIPE THIS",
  body: "AND ALSO PIPE THIS",
  reason: undefined,
  status: 200
}
*/

// virtual request timeout

done = false;
startTime = Date.now();
GET('#timeout')
  .setTimeout(1000)
  .then(printSuccess, printError)
  .always(finishTest);
wait(function () { return done; });

/* =>
error
{_buffer: "", body: "", reason: undefined, status: 0}
*/

// == SECTION core - worker virtual requests

// successful virtual requests

done = false;
startTime = Date.now();
GET('dev.grimwire.com/test/web/_worker.js#')
  .then(printSuccess, printError)
  .always(finishTest);
wait(function () { return done; });

/* =>
success
{
  body: "service resource",
  headers: {
    "content-type": "text/plain",
    link: "</>; rel=\"self current\", </events>; rel=\"collection\"; id=\"events\", </foo>; rel=\"collection\"; id=\"foo\", </{id}>; rel=\"collection\""
  },
  reason: "ok",
  status: 200
}
*/

// forced-virtual

done = false;
startTime = Date.now();
GET('dev.grimwire.com/test/web/_worker.js')
  .setVirtual()
  .then(printSuccess, printError)
  .always(finishTest);
wait(function () { return done; });

/* =>
success
{
  body: "service resource",
  headers: {
    "content-type": "text/plain",
    link: "</>; rel=\"self current\", </events>; rel=\"collection\"; id=\"events\", </foo>; rel=\"collection\"; id=\"foo\", </{id}>; rel=\"collection\""
  },
  reason: "ok",
  status: 200
}
*/

// unsuccessful virtual requests

done = false;
startTime = Date.now();
GET('dev.grimwire.com/test/web/_worker.js#/bad/url')
  .then(printSuccess, printError)
  .always(finishTest);
wait(function () { return done; });

/* =>
error
{body: "", headers: {},  reason: "not found", status: 404}
*/

// test of a unserializable response

done = false;
startTime = Date.now();
GET('dev.grimwire.com/test/web/_worker.js#unserializable-response')
  .then(printSuccess, printError)
  .always(finishTest);
wait(function () { return done; });

/* =>
success
{
  body: "[object Object]",
  headers: {"content-type": "text/faketype"},
  reason: "ok",
  status: 200
}
*/

// query params

done = false;
startTime = Date.now();
GET('dev.grimwire.com/test/web/_worker.js#', { foo: 'bar' })
  .then(printSuccess, printError)
  .always(finishTest);
wait(function () { return done; });

/* =>
success
{
  body: "service resource {\"foo\":\"bar\"}",
  headers: {
    "content-type": "text/plain",
    link: "</>; rel=\"self current\", </events>; rel=\"collection\"; id=\"events\", </foo>; rel=\"collection\"; id=\"foo\", </{id}>; rel=\"collection\""
  },
  reason: "ok",
  status: 200
}
*/

// query params 2

done = false;
startTime = Date.now();
GET('dev.grimwire.com/test/web/_worker.js#?foo=bar')
  .then(printSuccess, printError)
  .always(finishTest);
wait(function () { return done; });

/* =>
success
{
  body: "service resource {\"foo\":\"bar\"}",
  headers: {
    "content-type": "text/plain",
    link: "</>; rel=\"self current\", </events>; rel=\"collection\"; id=\"events\", </foo>; rel=\"collection\"; id=\"foo\", </{id}>; rel=\"collection\""
  },
  reason: "ok",
  status: 200
}
*/

// == SECTION core - data-uri requests

// non-base64-encoded

done = false;
startTime = Date.now();
GET('data:text/html;charset=utf-8,%3Ch1%3EHello%20World%21%3C%2Fh1%3E')
  .then(printSuccess, printError)
  .always(finishTest);
wait(function () { return done; });

/* =>
success
{
  ContentType: "text/html",
  _buffer: "<h1>Hello World!</h1>",
  body: "<h1>Hello World!</h1>",
  reason: undefined,
  status: 200
}
*/

// base64-encoded

done = false;
startTime = Date.now();
GET('data:text/html;charset=utf-8;base64,PGgxPkhlbGxvIFdvcmxkITwvaDE+')
  .then(printSuccess, printError)
  .always(finishTest);
wait(function () { return done; });

/* =>
success
{
  ContentType: "text/html",
  _buffer: "<h1>Hello World!</h1>",
  body: "<h1>Hello World!</h1>",
  reason: undefined,
  status: 200
}
*/

// empty body, non-base64-encoded

done = false;
startTime = Date.now();
GET('data:text/html;charset=utf-8,')
  .then(printSuccess, printError)
  .always(finishTest);
wait(function () { return done; });

/* =>
success
{
  ContentType: "text/html",
  _buffer: "",
  body: "",
  reason: undefined,
  status: 200
}
*/

// empty body, base64-encoded

done = false;
startTime = Date.now();
GET('data:text/html;charset=utf-8;base64,')
  .then(printSuccess, printError)
  .always(finishTest);
wait(function () { return done; });

/* =>
success
{
  ContentType: "text/html",
  _buffer: "",
  body: "",
  reason: undefined,
  status: 200
}
*/