// == SECTION navigator

var testServer = new Link.Navigator('http://linkapjs.com:8080');

// remote server navigation

done = false;
startTime = Date.now();
var fooCollection = testServer.collection('foo');
fooCollection.getJson()
  .then(printSuccess)
  .except(printErrorAndFinish)
  .then(function(res) {
    fooCollection.item('baz').get()
      .then(printSuccessAndFinish)
      .except(printErrorAndFinish);
  });
wait(function () { return done; });

/* =>
success
{
  _events: {},
  body: ["bar", "baz", "blah"],
  headers: {
    allow: "options, head, get",
    "content-type": "application/json",
    link: [
      {href: "/", rel: "up via service"},
      {href: "/foo", rel: "self current"},
      {href: "/foo/{title}", rel: "item"}
    ]
  },
  isConnOpen: true,
  reason: "Ok",
  status: 200
}
success
{
  _events: {},
  body: "baz",
  headers: {
    allow: "options, head, get",
    "content-type": "application/json",
    link: [
      {href: "/", rel: "via service"},
      {href: "/foo", rel: "up collection index"},
      {href: "/foo/baz", rel: "self current"},
      {href: "/foo/bar", rel: "first"},
      {href: "/foo/blah", rel: "last"},
      {href: "/foo/bar", rel: "prev"},
      {href: "/foo/blah", rel: "next"}
    ]
  },
  isConnOpen: true,
  reason: "Ok",
  status: 200
}
*/

// complex remote server navigation

done = false;
startTime = Date.now();
testServer
  .collection('foo')
  .item('bar')
  .up()
  .via()
  .self()
  .collection('foo').get()
    .then(printSuccessAndFinish)
    .except(printErrorAndFinish);
wait(function () { return done; });

/* =>
success
{
  _events: {},
  body: ["bar", "baz", "blah"],
  headers: {
    allow: "options, head, get",
    "content-type": "application/json",
    link: [
      {href: "/", rel: "up via service"},
      {href: "/foo", rel: "self current"},
      {href: "/foo/{title}", rel: "item"}
    ]
  },
  isConnOpen: true,
  reason: "Ok",
  status: 200
}
*/

// local server navigation

done = false;
startTime = Date.now();
var testLocal = new Link.Navigator('httpl://test.com');
testLocal.collection('foo').getJson()
  .then(printSuccess)
  .except(printErrorAndFinish)
  .then(function(res) {
    fooCollection.item('baz').get()
      .then(printSuccessAndFinish)
      .except(printErrorAndFinish);
  });
wait(function () { return done; });

/* =>
success
{
  _events: {},
  body: ["bar", "baz", "blah"],
  headers: {
    "content-type": "application/json",
    link: [
      {href: "/", rel: "up via service"},
      {href: "/foo", rel: "self current"},
      {href: "/foo/{title}", rel: "item"}
    ]
  },
  isConnOpen: true,
  reason: "ok",
  status: 200
}
success
{
  _events: {},
  body: "baz",
  headers: {
    allow: "options, head, get",
    "content-type": "application/json",
    link: [
      {href: "/", rel: "via service"},
      {href: "/foo", rel: "up collection index"},
      {href: "/foo/baz", rel: "self current"},
      {href: "/foo/bar", rel: "first"},
      {href: "/foo/blah", rel: "last"},
      {href: "/foo/bar", rel: "prev"},
      {href: "/foo/blah", rel: "next"}
    ]
  },
  isConnOpen: true,
  reason: "Ok",
  status: 200
}
*/

// local streaming

done = false;
startTime = Date.now();
var testLocal = new Link.Navigator('httpl://test.com');
testLocal.collection('foo').getJson(null, { stream:true })
  .then(printSuccess)
  .then(function(res) {
		print('---');
		res.on('data', function(payload) {
			print(payload);
			print(typeof payload);
			print(res.isConnOpen ? 'connection open' : 'connection closed');
		});
		res.on('end', function() {
			print(res.isConnOpen ? 'connection open' : 'connection closed');
			finishTest();
		});
	})
  .except(printErrorAndFinish);
wait(function () { return done; });

/* =>
success
{
  _events: {},
  body: null,
  headers: {
    "content-type": "application/json",
    link: [
      {href: "/", rel: "up via service"},
      {href: "/foo", rel: "self current"},
      {href: "/foo/{title}", rel: "item"}
    ]
  },
  isConnOpen: true,
  reason: "ok",
  status: 200
}
---
[
string
connection open
"bar"
string
connection open
,"baz"
string
connection open
,"blah"
string
connection open
]
string
connection open
connection closed
*/