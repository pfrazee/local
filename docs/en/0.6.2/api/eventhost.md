EventHost
=========

Manages response streams and provides functions to send event chunks en masse.

```javascript
var myevents = new local.EventHost();
local.addServer('eventhost', function(req, res) {
	res.writeHead(200, 'ok', { 'content-type': 'text/event-stream' });
	myevents.addStream(res);
});
// ...
myEvents.emit('news', { foo: 'bar' });
```

### local.EventHost()

Creates a new instance.

## local.EventHost

### .addStream(response)

 - `response`: required local.Response, the stream
 - returns number

Adds the stream as a recipient of future events. The returned number can be used as an identifier for the stream in future calls to the EventHost.

### .endStream(response)

 - `response`: required number|local.Response

Closes the stream and removes it from the EventHost.

### .endAllStreams()

Closes all streams and removes them from the EventHost.

### .emit(event, <span class="muted">data</span>, <span class="muted">opts</span>)

 - `event`: required string, the event name
 - `data`: optional any, the data to send with the event
 - `ops.exclude`: optional number|local.Response|Array(number)|Array(local.Response), streams which should not receive the event

### .emitTo(response, event, <span class="muted">data</span>)

 - `response`: required number|local.Response, the stream that should receive the event
 - `event`: required string, the event name
 - `data`: optional any, the data to send with the event