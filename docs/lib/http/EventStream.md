```javascript
var news = local.http.subscribe('http://myhost.com/news');
news.on('update', console.log.bind(console));
// { event: 'update', data: 'something has happened!' }
```

<br/>
### local.http.EventStream

Provided by `local.http.subscribe()`, inherits from `local.util.EventStream`.

<br/>
#### local.http.EventStream#close() <small>=> undefined</small>

Disconnects the response stream and emits the "close" event.