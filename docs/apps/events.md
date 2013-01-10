Server-Sent Events
==================

pfraze 2013


## Overview

(Server Sent Events)[https://developer.mozilla.org/en-US/docs/Server-sent_events/Using_server-sent_events] are response streams which are held open after the initial response, then fed event data which the client can respond to. Local provides `Link.subscribe()` for consuming these event streams (locally or remotely). You provide it a URL or a request which will initiate the 'text/event-stream' response:

```javascript
var user = null;
var userUpdates = Link.subscribe(app.config.userSource);
userUpdates.on(['subscribe','login','logout'], function(e) {
	user = e.data;
	myInterfaceBroadcast.emit('update'); // let's redraw everything
});
```

They can be used to sync interfaces between components and publish noteworthy changes.


## Common Client

Common Client uses event streams to know when to issue requests which update the document.

 > Read More: [**DOM Interactions via the Common Client**](apps/dom_behaviors.md)


## Further Topics

 - [Using LinkJS, the HTTP library](../lib/linkjs.md)
 - [Using CommonClient, the standard DOM behaviors](../lib/commonclient.md)
 - [Example: apps/social/wall.js](../examples/wall.md)