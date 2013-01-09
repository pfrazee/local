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