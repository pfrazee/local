Link.Broadcaster
================

pfraze 2013


## Overview

To manage event-stream subscribers from the server, there's `Link.Broadcaster`.

```javascript
var userBroadcast = Link.broadcaster();

// ...

Link.responder(response).ok('event-stream'); // use responder() to write the header
self.userBroadcast.addStream(response); // add the response stream to our listeners
self.userBroadcast.emit('new user', username); // send event to all streams
self.userBroadcast.emitTo(response, 'ready'); // send event to this stream
```


## API

### Link.broadcaster() <small>=> Broadcaster</small>

### addStream( <small>response</small> ) <small>=> undefined</small>

### endStream( <small>response</small> ) <small>=> undefined</small>

### endAllStreams() <small>=> undefined</small>

### emit( <small>eventName, [data]</small> ) <small>=> undefined</small>

### emitTo( <small>response, eventName, [data]</small> ) <small>=> undefined</small>