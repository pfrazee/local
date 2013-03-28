// == SECTION core - remote requests

// successful remote requests

done = false;
startTime = Date.now();
var res = Link.dispatch({ method:'get', url:'http://linkapjs.com:8080' });
res.then(printSuccess).except(printError).then(finishTest);
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
  isConnOpen: true,
  reason: "Ok",
  status: 200
}
*/

// unsuccessful remote requests

done = false;
startTime = Date.now();
var res = Link.dispatch({ method:'get', url:'http://linkapjs.com:8080/bad/url' });
res.then(printSuccess).except(printError).except(finishTest);
wait(function () { return done; });

/* =>
error
404: Not Found
*/

// == SECTION core - local requests

// successful local requests

done = false;
startTime = Date.now();
var res = Link.dispatch({ method:'get', url:'httpl://test.com' });
res.then(printSuccess).except(printError).then(finishTest);
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
      {href: "/foo", rel: "collection", title: "foo"},
      {href: "/{title}", rel: "collection"}
    ]
  },
  isConnOpen: true,
  reason: "ok",
  status: 200
}
*/

// unsuccessful local requests

done = false;
startTime = Date.now();
var res = Link.dispatch({ method:'get', url:'httpl://test.com/bad/url' });
res.then(printSuccess).except(printError).except(finishTest);
wait(function () { return done; });

/* =>
error
404: not found
*/