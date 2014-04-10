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
var res = local.dispatch({ method:'get', url:'local://test.com' });
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
var res = local.dispatch({ method:'get', url:'local://test.com/bad/url' });
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
  url: 'local://test.com/foo',
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
  url: 'local://test.com/foo',
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
  url: 'local://test.com/foo',
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
  url: 'local://test.com/foo',
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
var res = local.GET('local://test.com');
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
  url: 'local://test.com/foo',
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

// header() function

done = false;
startTime = Date.now();
var req = new local.Request({ method: 'GET', url: 'local://test.com' });
req.header('Accept', 'text/plain');
local.dispatch(req).then(
  function(res) { print('success'); print(res.header('Content-Type')); print(res.header('content-type')); },
  printError
).always(finishTest);
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
  url: 'local://test.com/timeout',
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
var res = local.dispatch({ method:'get', url:'local://dev.grimwire.com(test/web/_worker.js)' });
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
var res = local.dispatch({ method:'get', url:'local://dev.grimwire.com(test/web/_worker.js)/bad/url' });
res.then(printSuccess, printError).always(finishTest);
wait(function () { return done; });

/* =>
error
{body: "", headers: {},  reason: "not found", status: 404}
*/

// test of a unserializable response

done = false;
startTime = Date.now();
var res = local.dispatch({ method:'get', url:'local://dev.grimwire.com(test/web/_worker.js)/unserializable-response' });
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

// query params

done = false;
startTime = Date.now();
var res = local.dispatch({ method:'get', url:'local://dev.grimwire.com(test/web/_worker.js)', query: { foo: 'bar' } });
res.then(printSuccess, printError).always(finishTest);
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

// == SECTION core - nav-uri requests

// successful local requests

done = false;
startTime = Date.now();
var res = local.dispatch({ method:'get', url:'nav:||local://test.com|collection=foo|item=baz' });
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
var res = local.dispatch({ method:'get', url:'nav:||local://test.com|collection=lolno|item=baz' });
res.then(printSuccess, printError).always(finishTest);
wait(function () { return done; });

/* =>
error
{body: "", headers: {}, reason: "not found", status: 404}
*/

// unsuccessful local requests

done = false;
startTime = Date.now();
var res = local.dispatch({ method:'get', url:'nav:||local://test.com|collection=foo|item=blammo' });
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
var res = local.dispatch({ method:'get', url:'local://proxy/local://test.com' });
res.then(function(res) {
  res.parsedHeaders.link.forEach(function(link) {
    var props = Object.getOwnPropertyNames(link);
    print(props.map(function(prop){ return prop+'="'+link[prop]+'"'; }).join('; '));
  });
  return res;
}).then(printSuccess, printError).always(finishTest);
wait(function () { return done; });

/* =>
href="local://test.com/"; rel="self current http://grimwire.com/rel/test grimwire.com/rel/test grimwire.com"; host_domain="test.com"
href="local://test.com/events"; rel="collection"; id="events"; host_domain="test.com"
href="local://test.com/foo"; rel="collection"; id="foo"; host_domain="test.com"
href="local://test.com/{id}"; rel="collection"; host_domain="test.com"
success
{
  body: "service resource",
  headers: {
    "content-type": "text/plain",
    link: "<local://test.com/>; rel=\"self current http://grimwire.com/rel/test grimwire.com/rel/test grimwire.com\", <local://test.com/events>; rel=\"collection\"; id=\"events\", <local://test.com/foo>; rel=\"collection\"; id=\"foo\", <local://test.com/{id}>; rel=\"collection\"",
    "proxy-tmpl": "local://proxy/{uri}",
    via: "httpl/1.0 proxy"
  },
  reason: "ok",
  status: 200
}
*/

// proxy to proxy to local server

done = false;
startTime = Date.now();
var res = local.dispatch({ method:'get', url:'local://proxy/local://proxy/local://test.com' });
res.then(function(res) {
  res.parsedHeaders.link.forEach(function(link) {
    var props = Object.getOwnPropertyNames(link);
    print(props.map(function(prop){ return prop+'="'+link[prop]+'"'; }).join('; '));
  });
  return res;
}).then(printSuccess, printError).always(finishTest);
wait(function () { return done; });

/* =>
href="local://test.com/"; rel="self current http://grimwire.com/rel/test grimwire.com/rel/test grimwire.com"; host_domain="test.com"
href="local://test.com/events"; rel="collection"; id="events"; host_domain="test.com"
href="local://test.com/foo"; rel="collection"; id="foo"; host_domain="test.com"
href="local://test.com/{id}"; rel="collection"; host_domain="test.com"
success
{
  body: "service resource",
  headers: {
    "content-type": "text/plain",
    link: "<local://test.com/>; rel=\"self current http://grimwire.com/rel/test grimwire.com/rel/test grimwire.com\", <local://test.com/events>; rel=\"collection\"; id=\"events\", <local://test.com/foo>; rel=\"collection\"; id=\"foo\", <local://test.com/{id}>; rel=\"collection\"",
    "proxy-tmpl": "local://proxy/{uri} local://proxy/{uri}",
    via: "httpl/1.0 proxy, httpl/1.0 proxy"
  },
  reason: "ok",
  status: 200
}
*/

// Proxy-Tmpl header

done = false;
startTime = Date.now();
var proxyagent = local.agent('local://proxy/local://test.com');
var res = proxyagent.follow({ rel: 'collection', id: 'foo' }).GET();
res.then(function(res) {
  res.parsedHeaders.link.forEach(function(link) {
    var props = Object.getOwnPropertyNames(link);
    print(props.map(function(prop){ return prop+'="'+link[prop]+'"'; }).join('; '));
  });
  return res;
}).then(printSuccess, printError).always(finishTest);
wait(function () { return done; });

/* =>
href="local://test.com/"; rel="up via service"; host_domain="test.com"
href="local://test.com/foo"; rel="self current"; host_domain="test.com"
href="local://test.com/foo/{id}"; rel="item"; host_domain="test.com"
success
{
  body: ["bar", "baz", "blah"],
  headers: {
    "content-type": "application/json",
    link: "<local://test.com/>; rel=\"up via service\", <local://test.com/foo>; rel=\"self current\", <local://test.com/foo/{id}>; rel=\"item\"",
    "proxy-tmpl": "local://proxy/{uri}",
    via: "httpl/1.0 proxy"
  },
  reason: "ok",
  status: 200
}
*/

// Proxy-Tmpl header through the proxy-proxy

done = false;
startTime = Date.now();
var proxyagent = local.agent('local://proxy/local://proxy/local://test.com');
var res = proxyagent.follow({ rel: 'collection', id: 'foo' }).GET();
res.then(function(res) {
  res.parsedHeaders.link.forEach(function(link) {
    var props = Object.getOwnPropertyNames(link);
    print(props.map(function(prop){ return prop+'="'+link[prop]+'"'; }).join('; '));
  });
  return res;
}).then(printSuccess, printError).always(finishTest);
wait(function () { return done; });

/* =>
href="local://test.com/"; rel="up via service"; host_domain="test.com"
href="local://test.com/foo"; rel="self current"; host_domain="test.com"
href="local://test.com/foo/{id}"; rel="item"; host_domain="test.com"
success
{
  body: ["bar", "baz", "blah"],
  headers: {
    "content-type": "application/json",
    link: "<local://test.com/>; rel=\"up via service\", <local://test.com/foo>; rel=\"self current\", <local://test.com/foo/{id}>; rel=\"item\"",
    "proxy-tmpl": "local://proxy/{uri} local://proxy/{uri}",
    via: "httpl/1.0 proxy, httpl/1.0 proxy"
  },
  reason: "ok",
  status: 200
}
*/

// Proxy-Tmpl header w/noproxy links

done = false;
startTime = Date.now();
var proxyagent = local.agent('local://proxy');
var res = proxyagent.follow({ rel: 'self' }).GET();
res.then(function(res) {
  res.parsedHeaders.link.forEach(function(link) {
    var props = Object.getOwnPropertyNames(link);
    print(props.map(function(prop){ return prop+'="'+link[prop]+'"'; }).join('; '));
  });
  return res;
}).then(printSuccess, printError).always(finishTest);
wait(function () { return done; });

/* =>
href="local://proxy/"; rel="self service"; noproxy="true"; host_domain="proxy"
href="local://test.com"; rel="service"; host_domain="test.com"
href="local://proxy/{uri}"; rel="service"; noproxy="true"; host_domain="proxy"
success
{
  body: "",
  headers: {
    link: "</>; rel=\"self service\"; noproxy, <local://test.com>; rel=\"service\", </{uri}>; rel=\"service\"; noproxy",
    "proxy-tmpl": "local://proxy/{uri}"
  },
  reason: "ok, no content",
  status: 204
}
*/