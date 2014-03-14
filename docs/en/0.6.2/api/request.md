Request
=======

---

```javascript
var request = new local.Request({
	method: 'POST',
	url: 'httpl://foo',
	headers: { 'content-type': 'application/json' }
});
request.setHeader('accept', 'text/html');
var responsePromise = local.dispatch(request);
request.write('["foo":"bar"]');
request.end();
```

## local.Request

### .setHeader(header, value)

 - `header`: required string, the header key/name
 - `value`: required string|object

---

### .getHeader(header)

 - `header`: required string, the header key/name
 - returns string|object

---

### .removeHeader(header)

 - `header`: required string, the header key/name

---

### .header(header, <span class="muted">value</span>)

 - `header`: required string, the header key/name
 - `value`: optional string|object
 - returns string|object or undefined

If `value` is given, will update the value of `header` and returns undefined. Otherwise, returns the current value.

---

### .setTimeout(ms)

 - `ms`: required number, the timeout duration in milliseconds

---

### .write(data)

 - `data`: required string|object
 - returns `this`

Writes data to the request. This will notify the server with the "data" event.

If an object is given and a serialization function for the request's content-type is registered with `local.contentTypes`, Local.js will attempt to stringify the content before emitting "data".

---

### .end(<span class="muted">data</span>)

 - `data`: optional string|object
 - returns `this`

Closes the request, calling `write()` if `data` is provided, then emitting the "end" event at the server.

`local.Request` buffers all data written to the stream and save it to the `body` attribute. If a deserialization function for the request's content-type is registered with `local.contentTypes`, Local.js will attempt to parse the data before emitting "end".

---

### .close()

 - returns `this`

Closes the stream, emitting the "close" event on the server.

---

### .method

The string method, always uppercase

---

### .url

The string target resource (clientside only)

---

### .path

The string target resource (serverside only)

---

### .query

The query flags of the url, extracted and parsed into an object

---

### .headers

The headers as set by the client

---

### .parsedHeaders

The headers parsed by `local.httpHeaders`

---

### .body

The buffered request body

---

### .body_

A promise to the request body

---

### .stream

A boolean, should `dispatch()` fulfill its returned promise on the "headers" event or on the "end" event?

---

### .timeout

A number, the amount of time (in ms) to wait until aborting the request.

---

### .isConnOpen

A boolean

## Events

### "headers"

```
function (response) { }
```

---

### "data"

```
function (chunk) { }
```

---

### "end"

```
function () { }
```

---

### "close"

```
function () { }
```