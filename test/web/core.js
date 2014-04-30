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

// == SECTION core - document local requests

// successful local requests

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

// streamed local responses

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

// unsuccessful local requests

done = false;
startTime = Date.now();
GET('#bad/url').then(printSuccess, printError).always(finishTest);
wait(function () { return done; });

/* =>
error
{_buffer: "", body: "", reason: undefined, status: 404}
*/

// successful local posts

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

// streamed local post and streamed response

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

// local request timeout

done = false;
startTime = Date.now();
GET('#timeout')
  .setTimeout(1000)
  .then(printError, printSuccess)
  .always(finishTest);
wait(function () { return done; });

/* =>
success
{_buffer: "", body: null, reason: null, status: 0}
*/

// == SECTION core - worker local requests

// successful local requests

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

// unsuccessful local requests

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