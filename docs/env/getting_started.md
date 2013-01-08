Getting Started
===============

pfraze 2013


## Overview

This document explains the construction of a Local environment, and gives examples for how a simple environment may be created. (Note: the "environment" refers to the web page.)


## Key Points

The environment's responsibilities include:

 - Loading and managing local servers
 - Laying out the document into client regions and providing any common UI behaviors
 - Mediating all traffic between servers in order to protect the user's privacy
 - Managing the user session

Much of this is handled for you by various APIs.


### Local Servers

Local servers may run within the document or within workers. When in the document, they can be used to provide access to document APIs; for instance, you might wrap local storage, WebRTC, or even the DOM with them. Worker servers, meanwhile, are used to run untrusted applications. Use the worker servers to execute code which users provide.

 > Read more: [Building In-Document Servers](document_servers.md)


### Client Regions

Client regions are portions of the DOM which maintain their own browsing context. Functionally, they are like IFrames: clicking a link within one will change its contents only. You can add widgets and custom behaviors to them in the `postProcessRegion` function, which is called after every DOM update by a request.

 > Read more: [Adding Widgets and Client Behaviors](adding_widgets.md)


## A Simple Example

This is a complete example; that is, it includes all necessary functions of the environment.

```javascript
// helpers
function logError(err) {
	if (err instanceof Link.ResponseError) { console.log(err.message, err.request); }
	else { console.log(err.message); }
	return err;
}

// request wrapper
Environment.request = function(origin, request) {
	// make any connectivity / permissions decisions here
	if (Link.parse.url(request).protocol != 'httpl') {
		console.log('Sorry, only local traffic is allowed in this environment');
		return Environment.respond(403, 'forbidden');
	}

	// allow request
	var response = Link.request(request);
	response.except(logError); // `Link.request` returns a promise which will fail if response status >= 400
	return response;
};

// dom update post-processor
Environment.postProcessRegion = function(clientRegionElem) {
	// add any widgets here
	createMyWidgets(clientRegionElem.querySelectorAll('.my-widget'));
};

// instantiate services
Environment.addServer('localstorage.env', new LocalStorageServer());

// instantiate apps
Environment.addServer('editor.app', new Environment.WorkerServer({ scriptUrl:'/apps/editor.js' }));
Environment.addServer('files.app', new Environment.WorkerServer({ scriptUrl:'/apps/filetree.js', dataSource:'httpl://localstorage.env' }));

// load client regions
Environment.addClientRegion('editor').request('httpl://editor.app');
Environment.addClientRegion('files').request('httpl://files.app');
```


## Further Topics

 - [Building In-Document Servers](document_servers.md)
 - [Mediating Traffic for Security and Privacy](mediating_traffic.md)
 - [Adding Widgets and Client Behaviors](adding_widgets.md)
 - [Using the Environment API](../lib/environment.md)