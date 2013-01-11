Getting Started
===============

pfraze 2013


## Overview

The "environment" is the web page. It manages the local servers, lays out the document, regulates traffic for security, and maintains the user session. Much of this is handled for you by various APIs, but there are hooks available for customization.

Environment APIs are made available through the `Environment` object. It additionally uses the `Link`, `MyHouse`, and `CommonClient` libraries, which are discussed elsewhere.

 > Read More: [Using LinkJS, the HTTP library](../lib/linkjs.md)

 >  - [Using MyHouse, the Worker manager](lib/myhouse.md)

 >  - [Using CommonClient, the standard DOM behaviors](lib/commonclient.md)

 >  - [Using Promises, the flow-control tool](lib/promises.md)


## Routing Requests

In order to make Ajax requests which can target local servers, you use the `Link.request()` function. In the environment, however, all new traffic is dispatched by the `Environment.request()` wrapper, which takes an "origin" along with the request. This is so you can override the wrapper with your own logic:

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
```

The request wrapper is the high-level security and debugging system for the environment. All application traffic is routed through this function so permissions and access policies can be enforced. You decide what's right for your application, but keep in mind:

 - Data which reaches an application could be leaked via importScripts or an image URL, so protect sensitive data
 - "Auth" credentials should be attached to requests by the environment, and session ids should be stripped from responses 
 - Remote traffic should never be unregulated for untrusted apps
 - Use [Content Security Policies](https://developer.mozilla.org/en-US/docs/Security/CSP)!

 > Read More: [Mediating Traffic for Security and Privacy](env/mediating_traffic.md)


## Adding Widgets

When responses are added to the document, another hook function, `postProcessRegion()`, is called. It gives you the opportunity to bind events and add controls:

```javascript
// dom update post-processor
Environment.postProcessRegion = function(clientRegionElem) {
	// add any widgets here
	createMyWidgets(clientRegionElem.querySelectorAll('.my-widget'));
};
```

 > Read More: [Adding Widgets and Client Behaviors](env/adding_widgets.md)


## Instantiating Servers

Local servers may run within the document or within workers. When in the document, they can be used to provide access to document APIs; for instance, you might wrap local storage, WebRTC, or even the DOM with them. Worker servers, meanwhile, are used to run untrusted applications. Use the worker servers to execute user-programs.

```javascript
// instantiate services
Environment.addServer('localstorage.env', new LocalStorageServer());

// instantiate apps
Environment.addServer('editor.app', new Environment.WorkerServer({ scriptUrl:'/apps/editor.js' }));
Environment.addServer('files.app', new Environment.WorkerServer({ scriptUrl:'/apps/filetree.js', dataSource:'httpl://localstorage.env' }));
```

The object passed into `WorkerServer` is mixed into the application's `app.config` object. 

 > Read more: [Building In-Document Servers](document_servers.md)

 > - [Building an Application](apps/building.md)


## Creating Client Regions

Client regions are portions of the DOM which maintain their own browsing context. Functionally, they are like IFrames: clicking a link within one will change its contents only.

```javascript
// load client regions
Environment.addClientRegion('editor').request('httpl://editor.app');
Environment.addClientRegion('files').request('httpl://files.app');
```

 - Read More: [Using the Environment API](../lib/environment.md)

[Content Security Policies](https://developer.mozilla.org/en-US/docs/Security/CSP) are used to keep inline scripts from executing. They are currently set using 'meta' tags, but could also be established by response headers.

 > Note, [CSP](http://caniuse.com/#search=CSP) is a major criteria for [Browser Support](../misc/browser_support.md)

## Document

A document would then include the above script along with dependencies:

```html
<!-- base libraries -->
<script src="/lib/link.js"></script>
<script src="/lib/common-client.js"></script>
<script src="/lib/myhouse.js"></script>
<script src="/lib/environment.js"></script>

<!-- extension libraries -->
<script src="/lib/linkjs-ext/responder.js"></script>
<script src="/lib/linkjs-ext/router.js"></script>
<script src="/lib/linkjs-ext/broadcaster.js"></script>

<!-- environment -->
<script src="/docs.js"></script>
```

The environment is free to set styles as well.

 > More complete examples are found in the respository: index.html/js, profile.html/js, and docs.html/js


## Further Topics

 - [Building In-Document Servers](document_servers.md)
 - [Mediating Traffic for Security and Privacy](mediating_traffic.md)
 - [Adding Widgets and Client Behaviors](adding_widgets.md)
 - [Using the Environment API](../lib/environment.md)