// == SECTION core - remote requests

// successful remote requests

done = false;
startTime = Date.now();
var res = local.http.dispatch({ method:'get', url:'http://linkapjs.com:8080' });
res.then(printSuccess, printError).then(finishTest);
wait(function () { return done; });

/* =>
success
{
  _events: {},
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
  _events: {},
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
  _events: {},
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
{
  _events: {},
  body: null,
  headers: {},
  isConnOpen: false,
  reason: "not found",
  status: 404
}
*/