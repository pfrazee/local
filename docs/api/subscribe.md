Subscribe
=========

---

Opens an event-stream at the target URL and provides an object for listening to specific events. Uses the <a href="http://en.wikipedia.org/wiki/Server-sent_events">Server Sent Events</a> protocol.

```javascript
var news = local.subscribe('http://myhost.com/news');
news.on('update', console.log.bind(console));
// { event: 'update', data: 'something has happened!' }
```

### local.subscribe(request)

 - `request`: required string|object. If just a URL, will default the method to GET and the 'accept' header to 'text/event-stream'.
 - returns `local.EventStream`

Dispatches the request, then returns a `local.EventStream` which wraps around the response stream with an event-subscription interface.

<a href="#docs/api/eventstream.md">&raquo; EventStream</a>

---

### Hosting Event Streams

Use `local.EventHost` to track event streams and emit messages to them in bulk.

```javascript
var newsEventHost = new local.EventHost();
function myhost(req, res) {
	if (req.path == '/news' && local.preferredType(req, 'text/event-stream')) {
		newsEventHost.addStream(res);
		res.writeHead(200, 'ok', { 'content-type': 'text/event-stream' });
		// NOTE: do not call end (yet)
	}
	// ...
	newsEventHost.emit('update', 'something has happened!');
}
```

<a href="#docs/api/eventhost.md">&raquo; EventHost</a>