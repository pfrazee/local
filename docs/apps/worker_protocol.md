Worker Protocol
===============

pfraze 2013


## Overview

This document discusses how Workers are managed, including the load-process and communication protocols.

 > [Web Workers](https://developer.mozilla.org/en-US/docs/DOM/Using_web_workers) interoperate through the `postMessage()` interface. [MyHouse](../lib/myhouse.md) provides a base set of tools for building a communication protocol.


## Life-cycle

The life of the worker begins when the `WorkerServer` object is allocated in the environment. At that point, all HTTPL messages that arrive are placed in a queue, and the bootstrap script is loaded.

### Bootstrap

MyHouse tools are loaded: named messages, replies, message streams, remote script importing, remote object nullifying, and logging from within the worker. It posts the 'ready' message when it has loaded.

The environment nullifies `XMLHttpRequest` (so all remote traffic must go through the environment), then replies to the 'ready' message with configuration (assigned domain, id, and any other values you pass into its `WorkerServer` constructor). It then instructs the worker to import an HTTPL API, followed by the program itself.

 > Note, a man-in-the-middle attack might attempt to alter any of these scripts. Use HTTPS for these scripts as an extra precaution.

### Application Load

The program is either loaded from a remote URL (if `scriptUrl` is provided to the constructor) or from a data URL (if `script` is provided). Its code sets an HTTPL request handler, then posts the 'loaded' message. The environment marks the server as active, and releases HTTPL messages to it.

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

The server continues until `terminate()` is called on the `WorkerServer` instance, causing the program to unload immediately without application cleanup.


## HTTPL

HTTPL requests are always routed in the environment-- workers can not directly address each other. Instead, they dispatch requests to the document, and wait for responses.

The process of a request from a worker is as follows:

 - The 'httplRequest' message is dispatched to the document with the entire request contained (including the full request body-- no request streaming may occur at this time).
 - A promise is returned from the `request` function
 - The environment sends the request and retrieves a response.
 - The environment posts a reply to the original 'httplRequest' message with the response headers.
 - The worker generates a `ClientResponse` object and fulfills its promise with it.
 - The worker attaches to the reply's data stream (response streaming is supported currently, in order to enable Server-Sent Events over HTTPL).
 - As new messages arrive in the stream, their data is written to the `ClientResponse` object.
 - When the stream is closed, the `ClientResponse` is as well.

The process of a worker responding to a request is similar. It is as follows:

 - The 'httplRequest' message is received by the worker with the full request data.
 - It creates a `ServerResponse`, then passes it and the request to the application request handler.
 - The application fills the response object's headers with `writeHead`.
 - The worker replies to the original 'httplRequest' with the response headers.
 - A stream is created on the reply to pipe the 'write' stream to the environment.
 - When the response object is ended, the stream is closed.

Workers aren't able to use `EventSource` in their namespace, so they also have to ask the environment to do it on their behalf. That works as follows:

 - An `EventStream` is created in the worker, and is ultimately returned by the function.
 - The worker sends an 'httplSubscribe' message to the environment with the full initializing request.
 - It creates a stream out of that 'httplMessage', then sends the names of events it wishes to subscribe to.
 - The environment replies to those subscription chunks with actual event occurances, which the Worker pipes to the `EventStream` it created.


## Further Topics

 - [Building an Application](building.md)
 - [Using MyHouse, the Worker manager](../lib/myhouse.md)