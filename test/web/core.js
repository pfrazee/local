// == SECTION core - remote requests

// successful remote requests

done = false;
startTime = Date.now();
web.get('http://grimwire.com:8080')
  .accept('json')
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
web.get('http://grimwire.com:8080/bad/url').then(printSuccess, printError).always(finishTest);
wait(function () { return done; });

/* =>
error
{
  Allow: "OPTIONS, HEAD, GET, SUBSCRIBE",
  _buffer: "",
  body: "",
  links: [],
  reason: "Not Found",
  status: 404
}
*/

// aborted remote requests

done = false;
startTime = Date.now();
var request = web.get('http://grimwire.com:8080').accept('json').start();
request.then(printSuccess, printError).always(finishTest);
request.close();
wait(function () { return done; });
/* =>
error
{_buffer: "", body: null, reason: undefined, status: 0}
*/

// == SECTION core - document virtual requests

// successful virtual requests

done = false;
startTime = Date.now();
web.get('local://main').then(printSuccess, printError).always(finishTest);
wait(function () { return done; });

/* =>
success
{
  ContentType: "text/plain",
  Link: [
    {
      href: "local://main/",
      rel: "self current http://grimwire.com/rel/test grimwire.com/rel/test grimwire.com"
    },
    {href: "local://events", id: "events", rel: "collection"},
    {href: "local://main/foo", id: "foo", rel: "collection"},
    {href: "local://main/{id}", rel: "collection"}
  ],
  _buffer: "service resource",
  body: "service resource",
  links: [
    {
      href: "local://main/",
      rel: "self current http://grimwire.com/rel/test grimwire.com/rel/test grimwire.com"
    },
    {href: "local://events", id: "events", rel: "collection"},
    {href: "local://main/foo", id: "foo", rel: "collection"},
    {href: "local://main/{id}", rel: "collection"}
  ],
  reason: undefined,
  status: 200
}
*/

// virtual request speedtest

done = false;
startTime = Date.now();
web.get('local://main').end().always(finishTest);
wait(function () { return done; });
done = false;
startTime = Date.now();
web.get('local://main').end().always(finishTest);
wait(function () { return done; });
done = false;
startTime = Date.now();
web.get('local://main').bufferResponse(false).end().always(finishTest);
wait(function () { return done; });
print('done');
// => done

// streamed virtual responses

done = false;
startTime = Date.now();
web.get('local://main')
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
web.get('local://bad/url').then(printSuccess, printError).always(finishTest);
wait(function () { return done; });

/* =>
error
{_buffer: "", body: "", links: [], reason: "Not Found", status: 404}
*/

// successful virtual posts

done = false;
startTime = Date.now();
web.post('local://main/foo')
  .contentType('plain')
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
  links: [],
  reason: undefined,
  status: 200
}
*/

// streamed virtual post and streamed response

done = false;
startTime = Date.now();
var req = new web.Request({ method: 'POST', url: 'local://main/foo', ContentType: 'plain' });
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
web.get('local://headers-echo')
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
  links: [],
  reason: undefined,
  status: 204
}
*/

// mimetype aliases

done = false;
startTime = Date.now();
web.post('local://mimetype-aliases-echo')
  .accept('html')
  .contentType('csv')
  .end('foo,bar')
  .then(printSuccess, printError)
  .always(finishTest);
wait(function () { return done; });

/* =>
success
{
  ContentType: "text/html",
  _buffer: "<strong>foo,bar</strong>",
  body: "<strong>foo,bar</strong>",
  links: [],
  reason: undefined,
  status: 200
}
*/

// mimetype dispatchers

done = false;
startTime = Date.now();
web.postJson('local://main/foo', {}, {foo: 'bar'})
  .then(printSuccess, printError)
  .always(function() {
    return web.postJson('local://main/foo', {foo: 'bar'});
  })
  .then(printSuccess, printError)
  .always(function() {
    return web.getJson('local://accept-type');
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
success
{
  ContentType: "application/json",
  _buffer: {hello: "yo"},
  body: {hello: "yo"},
  links: [],
  reason: undefined,
  status: 200
}
*/

// mimetype enforcement

done = false;
startTime = Date.now();
web.post('local://mimetype-aliases-echo')
  .accept('json')
  .contentType('csv')
  .end('foo,bar')
  .then(printSuccess, printError)
  .always(function() {
    return web.post('local://mimetype-aliases-echo')
      .accept('html')
      .contentType('text/plain');
  })
  .then(printSuccess, printError)
  .always(finishTest);
wait(function () { return done; });

/* =>
error
{_buffer: "", body: "", links: [], reason: "can only provide html", status: 406}
error
{
  _buffer: "",
  body: "",
  links: [],
  reason: "only understands text/csv",
  status: 415
}
*/

// virtual body parsing

done = false;
startTime = Date.now();
web.post('local://parse-body')
  .contentType('json')
  .end(JSON.stringify({foo:"bar"}))
  .then(printSuccess, printError)
  .always(function() {
    return web.post('local://parse-body')
      .contentType('urlencoded')
      .end('foo2=bar2');
  })
  .then(printSuccess, printError)
  .always(finishTest);
wait(function () { return done; });

/* =>
success
{
  _buffer: {foo: "bar"},
  body: {foo: "bar"},
  links: [],
  reason: undefined,
  status: 200
}
success
{
  _buffer: {foo2: "bar2"},
  body: {foo2: "bar2"},
  links: [],
  reason: undefined,
  status: 200
}
*/

// virtual query parameters

done = false;
startTime = Date.now();
web.get('local://query-params', { thunder: 'flash' })
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
  links: [],
  reason: undefined,
  status: 200
}
*/

// virtual piping

done = false;
startTime = Date.now();
web.get('local://pipe', { src: 'local://main' })
  .then(printSuccess, printError)
  .always(function() {
    return web.post('local://pipe')
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
      href: "local://main/",
      rel: "self current http://grimwire.com/rel/test grimwire.com/rel/test grimwire.com"
    },
    {href: "local://events", id: "events", rel: "collection"},
    {href: "local://main/foo", id: "foo", rel: "collection"},
    {href: "local://main/{id}", rel: "collection"}
  ],
  _buffer: "SERVICE RESOURCE",
  body: "SERVICE RESOURCE",
  links: [
    {
      href: "local://main/",
      rel: "self current http://grimwire.com/rel/test grimwire.com/rel/test grimwire.com"
    },
    {href: "local://events", id: "events", rel: "collection"},
    {href: "local://main/foo", id: "foo", rel: "collection"},
    {href: "local://main/{id}", rel: "collection"}
  ],
  reason: undefined,
  status: 200
}
success
{
  _buffer: "AND ALSO PIPE THIS",
  body: "AND ALSO PIPE THIS",
  links: [],
  reason: undefined,
  status: 200
}
*/

// pipe request chains

done = false;
startTime = Date.now();
web.get('local://pipe', { src: 'local://main' })
  .pipe(web.post('local://pipe', { toLower: true }))
  .then(printSuccess, printError)
  .always(finishTest);
wait(function () { return done; });
/* =>
success
{
  ContentType: "text/piped+plain",
  _buffer: "service resource",
  body: "service resource",
  links: [],
  reason: undefined,
  status: 200
}
*/

// pipe request abort on 404

done = false;
startTime = Date.now();
web.get('local://not_gonna_find_anything_here')
  .pipe(web.post('local://pipe'))
  .then(printSuccess, printError)
  .always(finishTest);
wait(function () { return done; });
/* =>
error
{links: [], reason: "aborted by client", status: 0}
*/

// virtual request timeout

done = false;
startTime = Date.now();
web.get('local://timeout')
  .setTimeout(1000)
  .then(printSuccess, printError)
  .always(finishTest);
wait(function () { return done; });

/* =>
error
{_buffer: "", body: null, reason: undefined, status: 0}
*/

// request links

done = false;
startTime = Date.now();
web.get('local://req-links')
  .link('http://foo.com/bar', { rel: 'item', title: 'An Item' })
  .then(printSuccess, printError)
  .always(finishTest);
wait(function () { return done; });

/* =>
success
{
  ContentType: "application/json",
  _buffer: {href: "http://foo.com/bar", rel: "item", title: "An Item"},
  body: {href: "http://foo.com/bar", rel: "item", title: "An Item"},
  links: [],
  reason: undefined,
  status: 200
}
*/

// == SECTION core - worker virtual requests

// successful virtual requests

done = false;
startTime = Date.now();
web.get('local://worker')
  .then(printSuccess, printError)
  .always(finishTest);
wait(function () { return done; });

/* =>
success
{
  ContentType: "text/plain",
  Link: [
    {href: "local://worker/", rel: "self current"},
    {href: "local://worker/events", id: "events", rel: "collection"},
    {href: "local://worker/foo", id: "foo", rel: "collection"},
    {href: "local://worker/{id}", rel: "collection"}
  ],
  _buffer: "service resource",
  body: "service resource",
  links: [
    {href: "local://worker/", rel: "self current"},
    {href: "local://worker/events", id: "events", rel: "collection"},
    {href: "local://worker/foo", id: "foo", rel: "collection"},
    {href: "local://worker/{id}", rel: "collection"}
  ],
  reason: undefined,
  status: 200
}
*/

// virtual request speedtest

done = false;
startTime = Date.now();
web.get('local://worker').end().always(finishTest);
wait(function () { return done; });
done = false;
startTime = Date.now();
web.get('local://worker').end().always(finishTest);
wait(function () { return done; });
done = false;
startTime = Date.now();
web.get('local://worker').bufferResponse(false).end().always(finishTest);
wait(function () { return done; });
print('done');
// => done

// unsuccessful virtual requests

done = false;
startTime = Date.now();
web.get('local://worker/bad/url')
  .then(printSuccess, printError)
  .always(finishTest);
wait(function () { return done; });

/* =>
error
{_buffer: "", body: "", links: [], reason: undefined, status: 404}
*/

// successful virtual posts

done = false;
startTime = Date.now();
web.post('local://worker/foo')
  .contentType('plain')
  .end('echo this, please')
  .then(printSuccess, printError)
  .always(finishTest);
wait(function () { return done; });

/* =>
success
{
  ContentType: "text/plain",
  Link: [
    {href: "local://worker/", rel: "up via service"},
    {href: "local://worker/foo", rel: "self current"},
    {href: "local://worker/foo/{id}", rel: "item"}
  ],
  _buffer: "echo this, please",
  body: "echo this, please",
  links: [
    {href: "local://worker/", rel: "up via service"},
    {href: "local://worker/foo", rel: "self current"},
    {href: "local://worker/foo/{id}", rel: "item"}
  ],
  reason: undefined,
  status: 200
}
*/

// query params

done = false;
startTime = Date.now();
web.get('local://worker', { foo: 'bar' })
  .then(printSuccess, printError)
  .always(finishTest);
wait(function () { return done; });

/* =>
success
{
  ContentType: "text/plain",
  Link: [
    {href: "local://worker/", rel: "self current"},
    {href: "local://worker/events", id: "events", rel: "collection"},
    {href: "local://worker/foo", id: "foo", rel: "collection"},
    {href: "local://worker/{id}", rel: "collection"}
  ],
  _buffer: "service resource {\"foo\":\"bar\"}",
  body: "service resource {\"foo\":\"bar\"}",
  links: [
    {href: "local://worker/", rel: "self current"},
    {href: "local://worker/events", id: "events", rel: "collection"},
    {href: "local://worker/foo", id: "foo", rel: "collection"},
    {href: "local://worker/{id}", rel: "collection"}
  ],
  reason: undefined,
  status: 200
}
*/

// query params 2

done = false;
startTime = Date.now();
web.get('local://worker?foo=bar')
  .then(printSuccess, printError)
  .always(finishTest);
wait(function () { return done; });

/* =>
success
{
  ContentType: "text/plain",
  Link: [
    {href: "local://worker/", rel: "self current"},
    {href: "local://worker/events", id: "events", rel: "collection"},
    {href: "local://worker/foo", id: "foo", rel: "collection"},
    {href: "local://worker/{id}", rel: "collection"}
  ],
  _buffer: "service resource {\"foo\":\"bar\"}",
  body: "service resource {\"foo\":\"bar\"}",
  links: [
    {href: "local://worker/", rel: "self current"},
    {href: "local://worker/events", id: "events", rel: "collection"},
    {href: "local://worker/foo", id: "foo", rel: "collection"},
    {href: "local://worker/{id}", rel: "collection"}
  ],
  reason: undefined,
  status: 200
}
*/

// == SECTION core - data-uri requests

// non-base64-encoded

done = false;
startTime = Date.now();
web.get('data:text/html;charset=utf-8,%3Ch1%3EHello%20World%21%3C%2Fh1%3E')
  .then(printSuccess, printError)
  .always(finishTest);
wait(function () { return done; });

/* =>
success
{
  ContentType: "text/html",
  _buffer: "<h1>Hello World!</h1>",
  body: "<h1>Hello World!</h1>",
  links: [],
  reason: "OK",
  status: 200
}
*/

// base64-encoded

done = false;
startTime = Date.now();
web.get('data:text/html;charset=utf-8;base64,PGgxPkhlbGxvIFdvcmxkITwvaDE+')
  .then(printSuccess, printError)
  .always(finishTest);
wait(function () { return done; });

/* =>
success
{
  ContentType: "text/html",
  _buffer: "<h1>Hello World!</h1>",
  body: "<h1>Hello World!</h1>",
  links: [],
  reason: "OK",
  status: 200
}
*/

// empty body, non-base64-encoded

done = false;
startTime = Date.now();
web.get('data:text/html;charset=utf-8,')
  .then(printSuccess, printError)
  .always(finishTest);
wait(function () { return done; });

/* =>
success
{
  ContentType: "text/html",
  _buffer: "",
  body: "",
  links: [],
  reason: "OK",
  status: 200
}
*/

// empty body, base64-encoded

done = false;
startTime = Date.now();
web.get('data:text/html;charset=utf-8;base64,')
  .then(printSuccess, printError)
  .always(finishTest);
wait(function () { return done; });

/* =>
success
{
  ContentType: "text/html",
  _buffer: "",
  body: "",
  links: [],
  reason: "OK",
  status: 200
}
*/