Server-Sent Events
==================

pfraze 2013


## Overview

<a target="_top" href="https://developer.mozilla.org/en-US/docs/Server-sent_events/Using_server-sent_events">Server Sent Events</a> are response streams which are held open after the initial response, then fed event data which the client can respond to. Local provides `Link.subscribe()` for consuming these event streams (locally or remotely). You provide it a URL or a request which will initiate the 'text/event-stream' response:

```javascript
var user = null;
var sessionUpdates = Link.subscribe('httpl://session.env');
userUpdates.on(['login','logout'], function(e) {
	user = e.data;
	myInterfaceBroadcast.emit('update'); // let's redraw everything
});
```

They can be used to sync interfaces between components and publish noteworthy changes. In the example above, the user session is hosted by an in-document server (at 'httpl://session.env'). Login and logout events are then broadcasted for applications to handle.

To start the event stream, the host must serve a 'text/event-stream'. Local uses `Link.Broadcaster` to help manage the server-side:

```javascript
var myInterfaceBroadcast = Link.broadcaster();

// request router
app.onHttpRequest(function(request, response) {
	var router = Link.router(request);
	var respond = Link.responder(response);
	router.p('/', function() {
		// ...
		// event subscribe
		router.ma('GET', /event-stream/, function() {
			respond.ok('text/event-stream');
			myInterfaceBroadcast.addStream(response);
		});
		// ...
	});
});
```

An event stream can be used to trigger updates to the document. This is done by targetting a form to the event-stream, then embedding an `<output>` element in the form. Any 'update' events that are emitted by the stream will result in an html GET request to the stream's URL. The response html then replaces the output element.

```html
<form action="httpl://myserver.app">
	<output>
		The current user is {#if user}{{user}}{#else}not logged in{/if}.
	</output>
</form>
```

 > Read More: [DOM Interactions via the Common Client](dom_behaviors.md)


## Further Topics

 - [Using LinkJS, the HTTP library](../lib/linkjs.md)
 - [Using CommonClient, the standard DOM behaviors](../lib/commonclient.md)
 - [Example: apps/social/wall.js](../examples/wall.md)