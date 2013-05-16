```javascript
var news = local.http.subscribe('http://myhost.com/news');
news.on('update', console.log.bind(console));
// { event: 'update', data: 'something has happened!' }
```

<br/>
#### local.http.subscribe( <small>request</small> ) <small>=> local.http.EventStream</small>

Dispatches the request, then returns a `local.http.EventStream` which wraps around the response stream with an event-subscription interface.

 - `request` may be a URL, in which case method defaults to GET and Accept defaults to "text/event-stream"