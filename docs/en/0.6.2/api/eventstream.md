EventStream
===========

---

Wraps a response stream with an event-listening interface. Created by `local.subscribe()`. Descends from `local.util.EventEmitter`.

```javascript
var news = local.subscribe('http://myhost.com/news');
news.on('update', console.log.bind(console));
// { event: 'update', data: 'something has happened!' }
```

## local.EventStream

### .close()

Closes the stream.

### .reconnect()

Establishes the event-stream by redispatching the original request.

### .getUrl()

 - returns string, the URL hosting the event stream