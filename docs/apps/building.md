Building an Application
=======================

pfraze 2013


A simple server might look like this:

```javascript
importScripts('/lib/linkjs-ext/responder.js');
importScripts('/lib/linkjs-ext/router.js');
app.onHttplRequest(function(request, response) {
	Link.router(request).mpa('get', '/', /html/, function() {
		Link.responder(response).ok('html').end('<h1>Hello, World!</h1>');
	}).error(response);
});
app.postMessage('loaded');
```

## Server Tools

 > This section is duplicated in [Building In-Document Servers](../apps/document_servers.md)

Local revolves around HTTP, so a number of tools are provided to get the most out of it. This is a quick overview of the different APIs; more detail can be found in [Using LinkJS, the HTTP wrapper](../lib/linkjs.md).

### Link.request

Dispatches a request and returns a promise for the response. If the request URL's protocol is 'http' or 'https', it will issue an Ajax request. If it is 'httpl', it will issue a Web Worker or in-document request.

The promise is fulfilled if the response status is >= 200 && < 400. It is rejected if it is >= 400.

```javascript
var resPromise = Link.request({
	method:'post',
	url:'httpl://myapp.ui/some/resource', // or: `host:'httpl://myapp.ui'` and `path:'some/resource'`
	query:{ foo:'bar' }, // adds '?foo=bar' to the url
	headers:{
		'content-type':'application/json',
		'accept':'text/html'
	},
	body:requestPayload,
	stream:false // do I want the response streamed? (used for server-sent events, default `false`)
});
resPromise.then(function(res) {
	console.log(res.status, res.reason); // => 200 ok
	console.log(res.headers); // => { 'content-type':'application/json', ...}
	console.log(res.body); // => { foo:'bar', ...}
}).except(function(err) {
	console.log(err.message); // => 404: not found
	console.log(err.response); // => { res.status:404, res.reason:'not found', ...}
	return err;
});
```

 > Read more: [Using Promises, the flow-control tool](lib/promises.md)

### Link.subscribe

Subscribe provides [Server-Sent Events](https://developer.mozilla.org/en-US/docs/Server-sent_events/Using_server-sent_events) for local and remote Web servers. It takes a request in the same format as `Link.request()`, but it's also possible to just supply a URL, and it will default to a GET request.

```javascript
var eventStream = Link.subscribe('https://myhost.com/news');
eventStream.on('foo', function(event) {
	console.log(event.data); // => { foo:'bar', ...}
});
eventStream.on(['one', 'two'], function(event) { ...});
```

### Link.Router

Router is a wrapper interface for requests. It executes callbacks by pattern-matching, and generates an error response after a sequence of misses.

Router provides four different match functions: 'path' (p), 'method' (m), 'accept' (a), and 'content-type' (t). It combines those functions into an incomplete set of likely combinations (p, pm, pma, pmat, pmta, pmt, pa, pt, m, ma, mat, mta, mt, mp, mpa, mpt, mpat, mpta, a, at, t) for matching against. You may pass a string (for exact matches) or a regex, and the matches will be passed to the callback:

```javascript
var router = Link.router(request);
router.pm('/', /HEAD|GET/, self.handleListCollections.bind(self, request, respond));
router.pm(RegExp('^/(\w+)/?$','i'), /HEAD|GET/, function(match) {
	var collectionId = match.path[1];
	self.handleGetCollection(request, respond, collectionId);
});
router.pm(RegExp('^/(\w+)/(\w+)/?$','i'), /HEAD|GET/,function(match) {
	var collectionId = match.path[1];
	var itemId = match.path[2];
	self.handleGetItem(request, respond, collectionId, itemId);
});
router.error(response); // will generate a 404: not found or 405: method not allowed
```

The router tracks which partial hits occur and uses that information to produce the error response. In the example above, if the path hits but the method doesn't, a 405 will be created.

When a route hits, further routes will not execute. However, routes within the callback will. This allows multi-layer routing:

```javascript
router.pm('/', 'GET', function() {
	// ...
	router.a(/html/, function() {
		// ...
	});
	router.a(/json/, function() {
		// ...
	});
	router.error(response, ['path', 'method']); // will generate 406: not acceptable
});
router.error(response); // will generate 404: not found
```

Currently, when in a callback you must pass `error()` an array of the parameters matched by the parent router call in order to generate the correct response.

### Link.Responder

Responder is a wrapper interface for responses. It simplifies header-writing and response piping.

To write headers, you can call the `respond()` function like so:

```javascript
Link.responder(response).respond([200, 'ok'], 'text/html', { other:'headers' })
```

Most status codes have been given sugar codes to simplify this:

```javascript
Link.responder(response).ok('html'); // types are aliased -- 'html', 'json', 'xml'
Link.responder(response).notFound();
```

The complete list:

```javascript
// information
processing           : [102, 'server has received and is processing the request'],

// success
ok                   : [200, 'ok'],
created              : [201, 'request has been fulfilled; new resource created'],
accepted             : [202, 'request accepted, processing pending'],
shouldBeOk           : [203, 'request processed, information may be from another source'],
nonauthInfo          : [203, 'request processed, information may be from another source'],
noContent            : [204, 'request processed, no content returned'],
resetContent         : [205, 'request processed, no content returned, reset document view'],
partialContent       : [206, 'partial resource return due to request header'],

// redirection
multipleChoices      : [300, 'multiple options for the resource delivered'],
movedPermanently     : [301, 'this and all future requests directed to the given URI'],
found                : [302, 'response to request found via alternative URI'],
seeOther             : [303, 'response to request found via alternative URI'],
notModified          : [304, 'resource has not been modified since last requested'],
useProxy             : [305, 'content located elsewhere, retrieve from there'],
switchProxy          : [306, 'subsequent requests should use the specified proxy'],
temporaryRedirect    : [307, 'connect again to different uri as provided'],

// client error
badRequest           : [400, 'request cannot be fulfilled due to bad syntax'],
unauthorized         : [401, 'authentication is possible but has failed'],
forbidden            : [403, 'server refuses to respond to request'],
notFound             : [404, 'requested resource could not be found'],
methodNotAllowed     : [405, 'request method not supported by that resource'],
notAcceptable        : [406, 'content not acceptable according to the Accept headers'],
conflict             : [409, 'request could not be processed because of conflict'],
gone                 : [410, 'resource is no longer available and will not be available again'],
preconditionFailed   : [412, 'server does not meet request preconditions'],
unsupportedMediaType : [415, 'server does not support media type'],
teapot               : [418, 'I\'m a teapot'],
enhanceYourCalm      : [420, 'rate limit exceeded'],
unprocessableEntity  : [422, 'request unable to be followed due to semantic errors'],
locked               : [423, 'resource that is being accessed is locked'],
failedDependency     : [424, 'request failed due to failure of a previous request'],
internalServerError  : [500, 'internal server error'],

// server error
serverError          : [500, 'internal server error'],
notImplemented       : [501, 'server does not recognise method or lacks ability to fulfill'],
badGateway           : [502, 'server received an invalid response from upstream server'],
serviceUnavailable   : [503, 'server is currently unavailable'],
unavailable          : [503, 'server is currently unavailable'],
gatewayTimeout       : [504, 'gateway did not receive response from upstream server'],
insufficientStorage  : [507, 'server is unable to store the representation'],
notExtended          : [510, 'further extensions to the request are required']
```

When proxying out to another server, use `pipe`:

```javascript
Link.responder(response).pipe(Link.request(myRequest));
```

### Link.Headerer

Headerer is a wrapper interface for request and response headers. It provides functions to add and manage header values, and to serialize into string standards for use over HTTP/S. It currently provides:

```javascript
var headers = Link.headerer();
headers.setAuth({ scheme:'Basic', name:'pfraze', password:'foobar' });
headers.addLink('http://pfraze.net', 'related', { title:'mysite' });
headers.serialize(); // converts keys to string serializations
```

### Link.Navigator

Navigator is an HTTP agent for consuming services. It provides functions to navigate link headers and to send requests.

Link headers are followed by the `relation()` function, which produces a new `Navigator` with the new context. It doesn't remotely verify the location yet, however. Instead, it stores relations as 'relative' to the previous contexts, then resolves them to 'absolute' (full URLs) when a request is made.

The Link headers are expected to include, minimally, the 'href' and 'rel' attributes. The `href` may use [URI Templates](http://tools.ietf.org/html/rfc6570), which `relation(rel, param, extra)` uses as follows:

```javascript
var myhost = new Navigator('https://myhost.com');

var users = myservice.relation('collection', 'users');
// eg if: Link=[{ rel:'collection', href:'/{collection}' }]
// then: users='https://myhost.com/users'

var me = users.relation('item', 'pfraze');
// eg if: Link=[{ rel:'item', href:'/users/{item}' }, { rel:'service', href:'/' }]
// then: me='https://myhost.com/users'
```

Parameter 1 of `relation` specifies which link to use by matching the 'rel' value. Parameter 2 specifies what to use in the URI Template rendering, using the 'rel' value as the parameter name to replace. Parameter 3 can take an object of extra parameters to use when rendeirng the URI.

If a 'title' attribute is included in a Link header, it will be used as a matching criteria to parameter 2. That is, if `rel="service", title="foobar"`, then `myNavigator.relation('service', 'foobar')` will match it. This can be used as an alternative to URI Templates.

The `request()` function takes the request (optional) and two callbacks: success (status code >=200 & <400) and failure (status code >=400). Within the callbacks, the navigator is bound to 'this',

# :TODO: finish this when it sucks less

The `request()` and `relation()` functions have sugars for, respectively, the request methods and relation types. They can be used to reduce the number of parameters given:

```javascript
var myhost = new Navigator('https://myhost.com');
var me = myhost.collection('users').item('pfraze');

me.get(function(res) {
	// -> HEAD https://myhost.com
	// -> HEAD https://myhost.com/users
	// -> GET  https://myhost.com/users/pfraze

	this.patch({ body:{ email:'pfraze@foobar.com' }, headers:{ 'content-type':'application/json' }});
	// -> PATCH https://myhost.com/users/pfraze { email:'pfraze@foobar.com' }

	myhost.collection('users', { since:profile.id }).get(function(res2) {
		// -> GET https://myhost.com/users?since=123
		//...
	});
});
```

Notice that, within 

### Link.Broadcaster

Once an 'event-stream' is created ([Server Sent Events](https://developer.mozilla.org/en-US/docs/Server-sent_events/Using_server-sent_events)) events can be sent using `response.write`. Broadcaster provides tools to manage these streams and broadcast to them simultaneously.

```javascript
Link.responder(response).ok('event-stream');
self.userBroadcast.addStream(response);
self.userBroadcast.emit('new user', username);
self.userBroadcast.emitTo(response, 'ready');;
```

### Link.parseUri

[parseUri](http://stevenlevithan.com/demo/parseuri/js/) is written by Stephen Levithan. It breaks the input URL into its component parts:

```javascript
console.log(Link.parseUri('http://myserver.com/foobar?q=4').host); // => 'myserver.com'
```

### Link.UriTemplate

[**UriTemplate**](https://github.com/fxa/uritemplate-js) was written by Franz Antesberger. It generates URLs using URI Templates and some inputs:

```javascript
Link.UriTemplate.parse('http://myserver.com/{collection}/{?foo,bar}').expand({ collection:'friends', foo:1, bar:'b' });
// => "http://myserver.com/friends/?foo=1&bar=b"

```

### Link.contentTypes

Remote requests must have their payloads serialized and their responses deserialzed. `Link.contentTypes` provides a registry of de/serializers for various mimetypes. Json and `application/x-www-form-urlencoded` are provided by default.

```javascript
Link.contentTypes.register('application/json',
	function (obj) {
		try {
			return JSON.stringify(obj);
		} catch (e) {
			return '';
		}
	},
	function (str) {
		try {
			return JSON.parse(str);
		} catch (e) {
			return null;
		}
	}
);
Link.contentTypes.serialize({ foo:'bar' }, 'application/json');
// => '{ "foo":"bar" }'
Link.contentTypes.deserialize('{ "foo":"bar" }', 'application/json');
// => { foo:'bar' }
```

De/serializers are chosen by best match, according to the specificity of the provided mimetype. For instance, if 'application/foobar+json' is used, it will search for 'application/foobar+json', then 'application/json', then 'application'. If no match is found, the given parameter is returned as-is.