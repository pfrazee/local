Using LinkJS, the HTTP wrapper
==============================

pfraze 2013


## Overview

Link is a communication library built on HTTP. It abstracts over Ajax APIs to provide remote and local message delivery.

Local is messaging-heavy, but its software shouldn't get bogged down in protocol concerns. Link tries to abstract away as much as possible, while still giving full control. This manifests in various ways-- for instance, in the interpretation of a response code in 4xx or 5xx ranges as a rejected promise (see `Link.dispatch()` below). A number of tools have also been provided for ease; they are described in this document's subsections.

The two primary message-types for Link are "requests" and "events." Requests follow the Hyper-Text Transfer Protocol, and can target services on the Web (HTTP/S) or on the document (HTTPL). Events are constructed on top of HTTP using the Server-Sent Events protocol: subscription is accomplished by requesting a 'text/event-stream' from a service, then listening for writes to the response stream (which is left open indefinitely).

### Note

 - All headers are lowercase in Link


## Subsections

 - [Link.Navigator](linkjs/navigator.md): A browsing agent for APIs
 - [Link.Router](linkjs/router.md): A request-router for servers
 - [Link.Responder](linkjs/responder.md): A response-builder for servers
 - [Link.Headerer](linkjs/headerer.md): A request/response header builder
 - [Link.Broadcaster](linkjs/broadcaster.md): A text/event-stream manager for servers
 - [Link.EventEmitter](linkjs/eventemitter.md): Standard pubsub library, emulates the NodeJS API
 - [Link.contentTypes](linkjs/contenttypes.md): De/serialization of request & response bodies
 - [Helpers](linkjs/helpers.md): parseUri, parseLinkHeader, UriTemplate, and other tools


## HTTP Request/Response

### Link.dispatch( <small>request</small> ) <small>=> Promise(ClientResponse)</small>

Dispatches a request and returns a promise for the response. If the request URL's protocol is 'http' or 'https', it will issue an Ajax request. If it is 'httpl', it will issue the request to a Web Worker or in-document server.

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

Like much of Local's code, `dispatch` uses promises to handle async. If you're not familiar with promises, [have a look at the library's documentation](promises.md). `dispatch` returns a promise which is fulfilled if the response status is in the 2xx or 3xx ranges, or rejected if 4xx/5xx.

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

On success, the promise is fulfilled with a `ClientResponse` object, which is described below. Failures are rejected with the `ResponseError`, also described below (rejected promises always contain an Error subtype).

If the response is in the 1xx range, Link will consider it an error and reject it. This is temporary behavior; eventually, it will handle these protocol responses automatically.

### Link.ClientResponse

Interface to a request response which is provided to the request dispatcher (the client). It is a standard `EventEmitter`, and contains the following attributes:

 - status: the integer code indicating the response type
 - reason: the reason phrase provided by the server explaining the response
 - headers: an object of response headers, all lower-case
 - body: the payload of the response
 - isConnOpen: indicates whether the response stream is still open

If a request is made with the `stream:true` flag, then stream events must be listened for. `ClientResponse` is an `EventEmitter`, and its events are:

 - 'data': a chunk of new data has been added to the response
 - 'end': the connection has closed

The current payload is stored in req.body. Before 'end' is called, Link will try to deserialize the body into an object format (aka from json -> object) using `Link.contentTypes`. If `stream` is false, the 'end' event will still be fired, but the body will have already been deserialized and set to the response object.

### Link.ServerResponse

Interface to a request response which is provided to the request handler (the server). It follows the NodeJS `ServerResponse` API to some degree by implementing the following methods:

 - writeHead(status, reason, headers)
 - setHeader(k, v)
 - getHeader(k)
 - removeHeader(k)
 - write(data)
 - end(data)

### Link.ResponseError

A subtype of `Error`, indicates an HTTP response in the 4xx or 5xx range. The response object is stored in the 'response' attribute.


## Server-Sent Events

### Link.subscribe( <small>request/target_url</small> ) <small>=> EventStream</small>

Programs can subscribe to <a target="_top" href="https://developer.mozilla.org/en-US/docs/Server-sent_events/Using_server-sent_events">Server-Sent Events</a> from either local or remote Web servers. The protocol works by issuing a GET request for a 'text/event-stream' content-type, then leaves the streaming response open to receive event packets. As each event arrives, the listeners are notified:

```javascript
var eventStream = Link.subscribe('https://myhost.com/news');
eventStream.on('foo', function(event) {
    console.log(event.data); // => { foo:'bar', ...}
});
eventStream.on(['one', 'two'], function(event) { ...});
```

 > Read more: [Server-Sent Events in Local](events.md)

### Link.EventStream

Returned by `subscribe()`, behaves as an `EventEmitter` for an established 'text/event-stream' response. Includes the `close()` function for ending the subscription.


## Local Server Management

### Link.registerLocal( <small>domain, requestHandler, context</small> ) <small>=> undefined</small>

### Link.unregisterLocal( <small>domain</small> ) <small>=> undefined</small>

### Link.getLocal( <small>domain</small> ) <small>=> { fn:requestHandler, context:thisObj }</small>

### Link.getLocalRegistry() <small>=> array of { fn:requestHandler, context:thisObj }</small>


## Extensions

These functions are used to override `Link.dispatch()` and `Link.subscribe()`. This is so Web Workers can shuttle requests to the document for routing, but continue to use the rest of Link's API as usual.

### Link.setCustomDispatcher( <small>dispatcherFn</small> )

### Link.setCustomSubscriber( <small>subscriberFn</small> )
