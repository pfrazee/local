// == SECTION core - remote requests

// successful remote requests

done = false;
startTime = Date.now();
var res = local.http.dispatch({ method:'get', url:'http://linkapjs.com:8080', headers: { accept: 'application/json' } });
res.then(printSuccess, printError).then(finishTest);
wait(function () { return done; });

/* =>
success
{
  body: {hello: "world"},
  headers: {
    allow: "options, head, get",
    "content-type": "application/json",
    link: [
      {href: "/", rel: "self current"},
      {href: "/foo", rel: "collection", title: "foo"},
      {href: "/{title}", rel: "collection"}
    ]
  },
  isConnOpen: false,
  reason: "Ok",
  status: 200
}
*/

// unsuccessful remote requests

done = false;
startTime = Date.now();
var res = local.http.dispatch({ method:'get', url:'http://linkapjs.com:8080/bad/url' });
res.then(printSuccess, printError).fail(finishTest);
wait(function () { return done; });

/* =>
error
{
  body: "",
  headers: {allow: "options, head, get"},
  isConnOpen: false,
  reason: "Not Found",
  status: 404
}
*/

// == SECTION core - local requests

// successful local requests

done = false;
startTime = Date.now();
var res = local.http.dispatch({ method:'get', url:'httpl://test.com' });
res.then(printSuccess, printError).then(finishTest);
wait(function () { return done; });

/* =>
success
{
  body: "service resource",
  headers: {
    "content-type": "text/plain",
    link: [
      {href: "/", rel: "self current"},
      {href: "/events", rel: "collection", title: "events"},
      {href: "/foo", rel: "collection", title: "foo"},
      {href: "/{title}", rel: "collection"}
    ]
  },
  isConnOpen: false,
  reason: "ok",
  status: 200
}
*/

// unsuccessful local requests

done = false;
startTime = Date.now();
var res = local.http.dispatch({ method:'get', url:'httpl://test.com/bad/url' });
res.then(printSuccess, printError).fail(finishTest);
wait(function () { return done; });

/* =>
error
{body: null, headers: {}, isConnOpen: false, reason: "not found", status: 404}
*/

// == SECTION core - data-uri requests

// non-base64-encoded

done = false;
startTime = Date.now();
var res = local.http.dispatch({ method:'get', url:'data:text/html;charset=utf-8,%3Ch1%3EHello%20World%21%3C%2Fh1%3E' });
res.then(printSuccess, printError).then(finishTest);
wait(function () { return done; });

/* =>
success
{
  body: "<h1>Hello World!</h1>",
  headers: {"content-type": "text/html"},
  isConnOpen: false,
  reason: "ok",
  status: 200
}
*/

// base64-encoded

done = false;
startTime = Date.now();
var res = local.http.dispatch({ method:'get', url:'data:text/html;charset=utf-8;base64,PGgxPkhlbGxvIFdvcmxkITwvaDE+' });
res.then(printSuccess, printError).then(finishTest);
wait(function () { return done; });

/* =>
success
{
  body: "<h1>Hello World!</h1>",
  headers: {"content-type": "text/html"},
  isConnOpen: false,
  reason: "ok",
  status: 200
}
*/

// empty body, non-base64-encoded

done = false;
startTime = Date.now();
var res = local.http.dispatch({ method:'get', url:'data:text/html;charset=utf-8,' });
res.then(printSuccess, printError).then(finishTest);
wait(function () { return done; });

/* =>
success
{
  body: null,
  headers: {"content-type": "text/html"},
  isConnOpen: false,
  reason: "ok",
  status: 200
}
*/

// empty body, base64-encoded

done = false;
startTime = Date.now();
var res = local.http.dispatch({ method:'get', url:'data:text/html;charset=utf-8;base64,' });
res.then(printSuccess, printError).then(finishTest);
wait(function () { return done; });

/* =>
success
{
  body: null,
  headers: {"content-type": "text/html"},
  isConnOpen: false,
  reason: "ok",
  status: 200
}
*/