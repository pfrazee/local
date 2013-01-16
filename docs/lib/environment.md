Using the Environment API
=========================

pfraze 2013


## Overview

The `Environment` is the manager of client regions and local servers, and has extension points for both. Creating a Local deployment will always involve using the Environment to instantiate applications and override high-level behaviors.


## API

### addServer( <small>domain, server</small> ) <small>=> Environment.Server</small>

Adds the server to the local registry. `server` should be a subtype of `Environment.Server`

### killServer( <small>domain</small> ) <small>=> undefined</small>

Removes the server from the local registry and destroys it (calling `server.terminate()`).

### getServer( <small>domain</small> ) <small>=> Environment.Server</small>

### getServers() <small>=> [Environment.Server, ...]</small>

### addClientRegion( <small>elementId</small> ) <small>=> Environment.ClientRegion</small>

Begins CommonClient behaviors on the target element, and listens for request events.

### getClientRegion( <small>elementId</small> ) <small>=> Environment.ClientRegion</small>

### removeClientRegion( <small>elementId</small> ) <small>=> undefined</small>

### request( <small>origin, req</small> ) <small>=> promise(Link.ClientResponse)</small>

A hook for the deployment to override. Expected behavior is to wrap `Link.request()` while enforcing any security or session logic as needed.

### postProcessRegion( <small>element</small> ) <small>=> undefined</small>

A hook for the deployment to override. Called on a `ClientRegion`'s element after a response has been rendered to it. Expected behavior is to create any custom widgets or behaviors which are required by the deployment.

### Server

The local server base-type, can be extended to add new servers to the environment. `WorkerServer` extends from this.

Methods:

 - Server(): ctor, does little by default as common construction occurs in `Environment.addServer()`
 - handleHttpRequest(request, response): the request handler, should be overridden by subtypes
 - terminate(): the teardown function, should be overridden by subtypes
 - getSource(requester): a helper for server reflection, should provide the source to the server (if desired). Mostly useful for `WorkerServer`.

### WorkerServer

The local server for applications run within a worker. Extends `Environment.Server` and provides interfaces between the Web Worker and the environment.

The constructor may be called with the `scriptUrl` or `script` params. If the former, the application will be fetched remotely; if the latter, the application will be loaded from a data-uri which is built from the value of 'script'.

During initialization, all HTTP requests to the server are buffered. Once the application sends its 'loaded' message, the queued HTTP requests are delivered, and all future traffic is passed on. (This is accomplished by the `MyHouse.Sandbox` functions `bufferMessages()` and `releaseMessages()`.)

An application can request that it be terminated by posting the 'terminate' message.

Methods:

 - WorkerServer(config): ctor, instantiates the Web Worker and passes the `config` param to it
 - handleHttpRequest(request, response): posts the request into the worker, then uses `MyHouse` message streams to fulfill the `response`
 - terminate(): destroys the Web Worker
 - getSource(requester): responds with the application source, issuing a request for it if necessary (may provide a promise)

Message handlers:

 - 'ready': `MyHouse` has bootstrapped in the worker; does final preparation, then loads the application script
 - 'loaded': the application script has loaded; releases 'httpRequest' messages to the worker
 - 'httpRequest': the application has called `Link.request()`; dispatches the request, then streams the response back to the worker
 - 'httpSubscribe': the application has called `Link.subscribe()`; dispatches the request, then pipes the events back to the worker
 - 'log': the application has called `app.log()` or `console.log()`; prints the message data to the console

### ClientRegion

Represents a region of the document which maintains its own browsing context. Provides a 'request' DOM event handler, as well as a `request()` helper for dispatching 'request' events. Its prototype can be extended by deployments.

Methods:

 - ClientRegion(elemId): ctor, binds event handlers to the element referenced by elemId
 - request(requestObj): dispatches a 'request' DOM event on the element
 - terminate(): unbinds all event handlers; called by `Environment.removeClientRegion()`