```javascript
var userBroadcast = Link.broadcaster();
// ...
response.writeHead(200, 'ok', { 'content-type': 'text/event-stream' });
userBroadcast.addStream(response);
userBroadcast.emit('new user', username);
userBroadcast.emitTo(response, 'ready');
```

<br/>
The broadcaster is a helper for serving event-streams. It gives you a simple way to track open response streams and emit events to them. It automatically closes and deletes streams which are disconnected by the client.

### local.http.Broadcaster

The broacaster prototype. Use `local.http.broadcaster()` to instantiate.

<br/>
#### local.http.broadcaster() <small>=> local.http.Broadcaster</small>

<br/>
#### addStream( <small>response</small> ) <small>=> undefined</small>

<br/>
#### endStream( <small>response</small> ) <small>=> undefined</small>

<br/>
#### endAllStreams() <small>=> undefined</small>

<br/>
#### emit( <small>eventName, [data]</small> ) <small>=> undefined</small>

<br/>
#### emitTo( <small>response, eventName, [data]</small> ) <small>=> undefined</small>