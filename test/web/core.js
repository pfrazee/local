// == SECTION core - remote requests

// successful remote requests

done = false;
startTime = Date.now();
var res = local.dispatch({ method:'get', url:'http://grimwire.com:8080', headers: { accept: 'application/json' } });
res.then(printSuccess, printError).always(finishTest);
wait(function () { return done; });

/* =>
success
{
  body: {hello: "world"},
  headers: {
    allow: "OPTIONS, HEAD, GET, SUBSCRIBE",
    "content-type": "application/json",
    link: "</>; rel=\"self current\", </foo>; rel=\"collection\"; id=\"foo\", </{id}>; rel=\"collection\""
  },
  reason: "Ok",
  status: 200
}
*/

// unsuccessful remote requests

done = false;
startTime = Date.now();
var res = local.dispatch({ method:'get', url:'http://grimwire.com:8080/bad/url' });
res.then(printSuccess, printError).always(finishTest);
wait(function () { return done; });

/* =>
error
{
  body: "",
  headers: {allow: "OPTIONS, HEAD, GET, SUBSCRIBE"},
  reason: "Not Found",
  status: 404
}
*/

// aborted remote requests

done = false;
startTime = Date.now();
var request = new local.Request({ method:'get', url:'http://grimwire.com:8080', headers: { accept: 'application/json' } });
var res = local.dispatch(request);
res.then(printSuccess, printError).always(finishTest);
request.end();
request.close();
wait(function () { return done; });
/* => error
{body: "", headers: {}, reason: null, status: 0}
*/

// == SECTION core - document local requests

// successful local requests

done = false;
startTime = Date.now();
var res = local.dispatch({ method:'get', url:'httpl://test.com' });
res.then(printSuccess, printError).always(finishTest);
wait(function () { return done; });

/* =>
success
{
  body: "service resource",
  headers: {
    "content-type": "text/plain",
    link: "</>; rel=\"self current http://grimwire.com/rel/test grimwire.com/rel/test grimwire.com\", </events>; rel=\"collection\"; id=\"events\", </foo>; rel=\"collection\"; id=\"foo\", </{id}>; rel=\"collection\""
  },
  reason: "ok",
  status: 200
}
*/

// local requests without the scheme

done = false;
startTime = Date.now();
var res = local.dispatch({ method:'get', url:'test.com' });
res.then(printSuccess, printError).always(finishTest);
wait(function () { return done; });

/* =>
success
{
  body: "service resource",
  headers: {
    "content-type": "text/plain",
    link: "</>; rel=\"self current http://grimwire.com/rel/test grimwire.com/rel/test grimwire.com\", </events>; rel=\"collection\"; id=\"events\", </foo>; rel=\"collection\"; id=\"foo\", </{id}>; rel=\"collection\""
  },
  reason: "ok",
  status: 200
}
*/

// unsuccessful local requests

done = false;
startTime = Date.now();
var res = local.dispatch({ method:'get', url:'httpl://test.com/bad/url' });
res.then(printSuccess, printError).always(finishTest);
wait(function () { return done; });

/* =>
error
{body: "", headers: {},  reason: "not found", status: 404}
*/

// successful local posts

done = false;
startTime = Date.now();
var res = local.dispatch({
  method: 'post',
  url: 'httpl://test.com/foo',
  headers: { 'content-type': 'text/plain' },
  body: 'echo this, please'
});
res.then(printSuccess, printError).always(finishTest);
wait(function () { return done; });

/* =>
success
{
  body: "echo this, please",
  headers: {"content-type": "text/plain"},
  reason: "ok",
  status: 200
}
*/

// uppercase request headers

done = false;
startTime = Date.now();
var res = local.dispatch({
  method: 'post',
  url: 'httpl://test.com/foo',
  headers: { 'Content-Type': 'text/plain', 'Accept': 'text/plain' },
  body: 'echo this, please'
});
res.then(printSuccess, printError).always(finishTest);
wait(function () { return done; });

/* =>
success
{
  body: "echo this, please",
  headers: {"content-type": "text/plain"},
  reason: "ok",
  status: 200
}
*/

// uppercase request headers mixed into options

done = false;
startTime = Date.now();
var res = local.dispatch({
  method: 'POST', Accept: 'text/plain',
  url: 'httpl://test.com/foo',
  body: 'echo this, please', 'Content-Type': 'text/plain'
});
res.then(printSuccess, printError).always(finishTest);
wait(function () { return done; });

/* =>
success
{
  body: "echo this, please",
  headers: {"content-type": "text/plain"},
  reason: "ok",
  status: 200
}
*/

// uppercase underscores in headers to avoid quotes

done = false;
startTime = Date.now();
var res = local.dispatch({
  method: 'POST', Accept: 'text/plain',
  url: 'httpl://test.com/foo',
  body: 'echo this, please', Content_Type: 'text/plain',
});
res.then(printSuccess, printError).always(finishTest);
wait(function () { return done; });

/* =>
success
{
  body: "echo this, please",
  headers: {"content-type": "text/plain"},
  reason: "ok",
  status: 200
}
*/

// request sugar (GET)

done = false;
startTime = Date.now();
var res = local.GET('httpl://test.com');
res.then(printSuccess, printError).always(finishTest);
wait(function () { return done; });

/* =>
success
{
  body: "service resource",
  headers: {
    "content-type": "text/plain",
    link: "</>; rel=\"self current http://grimwire.com/rel/test grimwire.com/rel/test grimwire.com\", </events>; rel=\"collection\"; id=\"events\", </foo>; rel=\"collection\"; id=\"foo\", </{id}>; rel=\"collection\""
  },
  reason: "ok",
  status: 200
}
*/

// request sugar (POST)

done = false;
startTime = Date.now();
var res = local.POST('echo this, please', {
  url: 'httpl://test.com/foo',
  Accept: 'text/plain',
  Content_Type: 'text/plain',
});
res.then(printSuccess, printError).always(finishTest);
wait(function () { return done; });

/* =>
success
{
  body: "echo this, please",
  headers: {"content-type": "text/plain"},
  reason: "ok",
  status: 200
}
*/

// uppercase headers in responses

done = false;
startTime = Date.now();
var res = local.dispatch({ method: 'GET', Accept: 'text/plain', url: 'httpl://test.com' });
res.then(
  function(res) { print('success'); print(res['Content-Type']); print(res.Content_Type); },
  printError).always(finishTest);
wait(function () { return done; });

/* =>
success
text/plain
text/plain
*/

// local request timeout

done = false;
startTime = Date.now();
var res = local.dispatch({
  method: 'get',
  url: 'httpl://test.com/timeout',
  timeout: 1000
});
res.then(printError, printSuccess).always(finishTest);
wait(function () { return done; });

/* =>
success
{body: "", headers: {}, reason: null, status: 0}
*/

// == SECTION core - worker local requests

// successful local requests

done = false;
startTime = Date.now();
var res = local.dispatch({ method:'get', url:'httpl://_worker.js' });
res.then(printSuccess, printError).always(finishTest);
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
var res = local.dispatch({ method:'get', url:'httpl://_worker.js/bad/url' });
res.then(printSuccess, printError).always(finishTest);
wait(function () { return done; });

/* =>
error
{body: "", headers: {},  reason: "not found", status: 404}
*/

// test of a unserializable response

done = false;
startTime = Date.now();
var res = local.dispatch({ method:'get', url:'httpl://_worker.js/unserializable-response' });
res.then(printSuccess, printError).always(finishTest);
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

// == SECTION core - nav-uri requests

// successful local requests

done = false;
startTime = Date.now();
var res = local.dispatch({ method:'get', url:'nav:||httpl://test.com|collection=foo|item=baz' });
res.then(printSuccess, printError).always(finishTest);
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
*/

// unsuccessful local requests

done = false;
startTime = Date.now();
var res = local.dispatch({ method:'get', url:'nav:||httpl://test.com|collection=lolno|item=baz' });
res.then(printSuccess, printError).always(finishTest);
wait(function () { return done; });

/* =>
error
{body: "", headers: {}, reason: "not found", status: 404}
*/

// unsuccessful local requests

done = false;
startTime = Date.now();
var res = local.dispatch({ method:'get', url:'nav:||httpl://test.com|collection=foo|item=blammo' });
res.then(printSuccess, printError).always(finishTest);
wait(function () { return done; });

/* =>
error
{body: "", headers: {}, reason: "not found", status: 404}
*/

// == SECTION core - data-uri requests

// non-base64-encoded

done = false;
startTime = Date.now();
var res = local.dispatch({ method:'get', url:'data:text/html;charset=utf-8,%3Ch1%3EHello%20World%21%3C%2Fh1%3E' });
res.then(printSuccess, printError).always(finishTest);
wait(function () { return done; });

/* =>
success
{
  body: "<h1>Hello World!</h1>",
  headers: {"content-type": "text/html"},
  reason: "ok",
  status: 200
}
*/

// base64-encoded

done = false;
startTime = Date.now();
var res = local.dispatch({ method:'get', url:'data:text/html;charset=utf-8;base64,PGgxPkhlbGxvIFdvcmxkITwvaDE+' });
res.then(printSuccess, printError).always(finishTest);
wait(function () { return done; });

/* =>
success
{
  body: "<h1>Hello World!</h1>",
  headers: {"content-type": "text/html"},
  reason: "ok",
  status: 200
}
*/

// empty body, non-base64-encoded

done = false;
startTime = Date.now();
var res = local.dispatch({ method:'get', url:'data:text/html;charset=utf-8,' });
res.then(printSuccess, printError).always(finishTest);
wait(function () { return done; });

/* =>
success
{body: "", headers: {"content-type": "text/html"}, reason: "ok", status: 200}
*/

// empty body, base64-encoded

done = false;
startTime = Date.now();
var res = local.dispatch({ method:'get', url:'data:text/html;charset=utf-8;base64,' });
res.then(printSuccess, printError).always(finishTest);
wait(function () { return done; });

/* =>
success
{body: "", headers: {"content-type": "text/html"}, reason: "ok", status: 200}
*/


// == SECTION core - proxy requests

// proxy to local server

done = false;
startTime = Date.now();
var res = local.dispatch({ method:'get', url:'httpl://proxy/httpl://test.com' });
res.then(function(res) {
  res.parsedHeaders.link.forEach(function(link) {
    var props = Object.getOwnPropertyNames(link);
    print(props.map(function(prop){ return prop+'="'+link[prop]+'"'; }).join('; '));
  });
  return res;
}).then(printSuccess, printError).always(finishTest);
wait(function () { return done; });

/* =>
href="httpl://proxy/httpl%3A%2F%2Ftest.com%2F"; rel="self current http://grimwire.com/rel/test grimwire.com/rel/test grimwire.com"; host_domain="test.com"; host_proxy="httpl://proxy"
href="httpl://proxy/httpl%3A%2F%2Ftest.com%2Fevents"; rel="collection"; id="events"; host_domain="test.com"; host_proxy="httpl://proxy"
href="httpl://proxy/httpl%3A%2F%2Ftest.com%2Ffoo"; rel="collection"; id="foo"; host_domain="test.com"; host_proxy="httpl://proxy"
href="httpl://proxy/httpl%3A%2F%2Ftest.com%2F%7Bid%7D"; rel="collection"; host_domain="test.com"; host_proxy="httpl://proxy"
success
{
  body: "service resource",
  headers: {
    "content-type": "text/plain",
    link: "</httpl%3A%2F%2Ftest.com%2F>; rel=\"self current http://grimwire.com/rel/test grimwire.com/rel/test grimwire.com\", </httpl%3A%2F%2Ftest.com%2Fevents>; rel=\"collection\"; id=\"events\", </httpl%3A%2F%2Ftest.com%2Ffoo>; rel=\"collection\"; id=\"foo\", </httpl%3A%2F%2Ftest.com%2F%7Bid%7D>; rel=\"collection\"",
    via: "httpl/1.0 proxy"
  },
  reason: "ok",
  status: 200
}
*/

// proxy to proxy to local server

done = false;
startTime = Date.now();
var res = local.dispatch({ method:'get', url:'httpl://proxy/httpl://proxy/httpl://test.com' });
res.then(function(res) {
  res.parsedHeaders.link.forEach(function(link) {
    var props = Object.getOwnPropertyNames(link);
    print(props.map(function(prop){ return prop+'="'+link[prop]+'"'; }).join('; '));
  });
  return res;
}).then(printSuccess, printError).always(finishTest);
wait(function () { return done; });

/* =>
href="httpl://proxy/httpl%3A%2F%2Fproxy%2Fhttpl%253A%252F%252Ftest.com%252F"; rel="self current http://grimwire.com/rel/test grimwire.com/rel/test grimwire.com"; host_domain="test.com"; host_proxy="httpl://proxy/httpl%3A%2F%2Fproxy"
href="httpl://proxy/httpl%3A%2F%2Fproxy%2Fhttpl%253A%252F%252Ftest.com%252Fevents"; rel="collection"; id="events"; host_domain="test.com"; host_proxy="httpl://proxy/httpl%3A%2F%2Fproxy"
href="httpl://proxy/httpl%3A%2F%2Fproxy%2Fhttpl%253A%252F%252Ftest.com%252Ffoo"; rel="collection"; id="foo"; host_domain="test.com"; host_proxy="httpl://proxy/httpl%3A%2F%2Fproxy"
href="httpl://proxy/httpl%3A%2F%2Fproxy%2Fhttpl%253A%252F%252Ftest.com%252F%257Bid%257D"; rel="collection"; host_domain="test.com"; host_proxy="httpl://proxy/httpl%3A%2F%2Fproxy"
success
{
  body: "service resource",
  headers: {
    "content-type": "text/plain",
    link: "</httpl%3A%2F%2Fproxy%2Fhttpl%253A%252F%252Ftest.com%252F>; rel=\"self current http://grimwire.com/rel/test grimwire.com/rel/test grimwire.com\", </httpl%3A%2F%2Fproxy%2Fhttpl%253A%252F%252Ftest.com%252Fevents>; rel=\"collection\"; id=\"events\", </httpl%3A%2F%2Fproxy%2Fhttpl%253A%252F%252Ftest.com%252Ffoo>; rel=\"collection\"; id=\"foo\", </httpl%3A%2F%2Fproxy%2Fhttpl%253A%252F%252Ftest.com%252F%257Bid%257D>; rel=\"collection\"",
    via: "httpl/1.0 proxy, httpl/1.0 proxy"
  },
  reason: "ok",
  status: 200
}
*/