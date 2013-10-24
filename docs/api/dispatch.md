dispatch()
==========

---

Sends a new request and returns a promise for the response.

```javascript
var resPromise = local.dispatch({
    method: 'POST',
    url: 'httpl://myserver',
    headers: { 'content-type': 'application/json', accept: 'text/html' },
    body: myMessage
});
resPromise.then(
	function(res) {
		assert(res.status >= 200 && res.status <= 399);
	},
	function(res) {
		assert(res.status >= 400 && res.status <= 599);
	}
);
```

### local.http.dispatch(request)

`request` must fit the following schema description:

```
{
  url:     required string
  method:  optional string; defaults to 'GET'
  query:   optional object; a map of query parameters to add to the url
  headers: optional object; should include a (all lower-case) map of headers to values
  body:    optional object; the request payload
  stream:  optional boolean; specifies whether the response should be given in chunks
  binary:  optional boolean; receive a binary arraybuffer response? Only applies to HTTP/S
}
```

All requests are sent on the next tick.

### Request Streaming

If you want to stream the body of the request, use a `local.Request` object in `dispatch()`, then use the request's API to add data and finish the stream.

```javascript
var req = new local.Request({
    method: 'POST',
    url: 'httpl://myserver',
    headers: { 'content-type': 'application/json', accept: 'text/html' }
});
local.http.dispatch(req);
req.send(chunk1);
req.send(chunk2);
req.end();
```

You must always call end() to complete the request when streaming.

### Response Streaming

By default, Local.js will fulfill the response promise after the response stream ends. However, if `stream` is set to true, it will fulfill when the headers arrive, allowing you to handle the chunks individually.

```javascript
local.dispatch({ url: 'httpl://myserver', headers: { accept: 'text/plain' }, stream: true })
	.then(function(res) {
		res.on('data', function(chunk) { /* ... */ });
		res.on('end', function(chunk) { /* ... */ });
	});
```