Building In-Document Servers
============================

pfraze 2013


## Overview

In-document servers are extensions to the environment for use by user applications. They tend to provide mediated access to document features (such as local storage) and to the environment itself (such active servers and session data).

 > Note: In-document servers are not sandboxed, and should not be used if not trusted.

To build an in-document server, build a descendent prototype to `Environment.Server` and override `handleHttpRequest` with a custom handler. Except for living in the document namespace, they behave exactly as Worker servers.

```javascript
function CustomEnvironmentServer() {
	Environment.Server.call(this);
}
CustomEnvironmentServer.prototype = Object.create(Environment.Server.prototype);
CustomEnvironmentServer.prototype.handleHttpRequest = function(request, response) {
	response.writeHead(200, 'ok');
	response.end();
};
```

You may also wish to override `terminate()` if you wish to add deconstruction behavior.


## Server Tools

 > This section is duplicated in [Building an Application](../apps/building.md)

Local revolves around HTTP, so a number of tools are provided to get the most out of it. This is a quick overview of the different APIs; more detail can be found in [Using LinkJS, the HTTP wrapper](../lib/linkjs.md).

### Link.dispatch( <small>request</small> )

Dispatches a request and returns a promise for the response. If the request URL's protocol is 'http' or 'https', it will issue an Ajax request. If it is 'httpl', it will issue a Web Worker or in-document request.

```javascript
var resPromise = Link.dispatch({
	method:'post',
	url:'httpl://myapp.ui/some/resource',
	// or `host:'httpl://myapp.ui'` and `path:'some/resource'`
	query:{ foo:'bar' }, // adds '?foo=bar' to the url
	headers:{
		'content-type':'application/json',
		'accept':'text/html'
	},
	body:requestPayload,
	stream:false // do I want the response streamed? default false
	             // (used for server-sent events)
});
```

Like much of Local's code, `dispatch` uses promises to handle async. If you're not familiar with promises, [have a look at the library's documentation](../lib/promises.md). `dispatch` returns a promise which is fulfilled if the response status is >= 200 && < 400, or rejected if >= 400.

```javascript
resPromise
	.then(function(res) {
		console.log(res.status, res.reason);
		// => 200 ok
		console.log(res.headers);
		// => { 'content-type':'application/json', ...}
		console.log(res.body);
		// => { foo:'bar', ...}
	})
	.except(function(err) {
		console.log(err.message);
		// => 404: not found
		console.log(err.response);
		// => { status:404, reason:'not found', ...}
		return err;
	});
```

If you're writing in-document (environment) code, you might want to use `Environment.dispatch()` instead. This gives the environment an opportunity to examine and route the request.

 > Note: worker applications use `Link.dispatch`, but the request payload is delivered to the environment and dispatched via `Environment.dispatch`

The usage is similar, except for an extra 'origin' parameter:

```javascript
Environment.dispatch(this, myrequest)
	.then(success)
	.except(failure);
```

### Link.subscribe( <small>request/target url</small> )

Programs can subscribe to <a target="_top" href="https://developer.mozilla.org/en-US/docs/Server-sent_events/Using_server-sent_events">Server-Sent Events</a> from either local or remote Web servers. The protocol works by issuing a GET request for a 'text/event-stream' content-type, then leaves the streaming response open to receive event packets. As each event arrives, the listeners are notified:

```javascript
var eventStream = Link.subscribe('https://myhost.com/news');
eventStream.on('foo', function(event) {
	console.log(event.data); // => { foo:'bar', ...}
});
eventStream.on(['one', 'two'], function(event) { ...});
```

 > Read more: [Server-Sent Events in Local](../apps/events.md)

### Link.Broadcaster

To manage event-stream subscribers from the server, there's `Link.Broadcaster`.

```javascript
var userBroadcast = Link.broadcaster();

// ...

Link.responder(response).ok('event-stream'); // use responder() to write the header
self.userBroadcast.addStream(response); // add the response stream to our listeners
self.userBroadcast.emit('new user', username); // send event to all streams
self.userBroadcast.emitTo(response, 'ready'); // send event to this stream
```

 > Read more: [Server-Sent Events in Local](../apps/events.md)

### Link.Router

Router is a wrapper interface for handling requests. It executes callbacks by pattern-matching against the request, and it helps generate the error response after a request goes unmatched.

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
Link.responder(response).pipe(Link.dispatch(myRequest));
```

### Link.Headerer

Headerer is a wrapper interface for request and response headers. It provides functions to add and manage header values, and to serialize into string standards for use over HTTP/S. It currently provides:

```javascript
var headers = Link.headerer();
headers.setAuth({ scheme:'Basic', name:'pfraze', password:'foobar' });
headers.addLink('http://pfraze.net', 'related', { title:'mysite' });
headers.serialize(); // converts keys to string serializations
// ...
Link.responder(response).ok('html', headers).end(theHtml);
```


## Further Topics

 - [Using LinkJS, the HTTP wrapper](../lib/linkjs.md)
 - [Example: env/localstorage.js](../examples/localstorage.md)
 - [Example: env/persona.js](../examples/persona.md)
 - [Example: env/reflector.js](../examples/reflector.md)