Response
========

---

```javascript
response.setHeader('link', [
	{ rel:'self', href:'/' }
]);
response.writeHead(200, 'ok', { 'content-type': 'text/html' });
response.end('<h1>Hello, World!</h1>');
```

## local.Response

### .writeHead(status, <span class="muted">reason</span>, <span class="muted">headers</span>)

 - `status`: required number, the numeric result code (<a href="http://httpstatus.es/">Statuses Reference</a>).
 - `reason`: optional string, a phrase explaining the result
 - `headers`: optional object, a dictionary of header values
 - returns `this`

Initiates the response transmission. After calling this function, headers can not be altered.

Header values may be objects if a serialization function is registered with `local.httpHeaders`.

<a href="#docs/api/httpheaders.md">&raquo; httpHeaders</a>

---

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

### .write(data)

 - `data`: required string|object
 - returns `this`

Writes data to the response. This will notify the client with the "data" event.

If an object is given and a serialization function for the response's content-type is registered with `local.contentTypes`, Local.js will attempt to stringify the content before emitting "data".

---

### .end(<span class="muted">data</span>)

 - `data`: optional string|object
 - returns `this`

Closes the response, calling `write()` if `data` is provided, then emitting the "end" event to the client.

`local.Response` buffers all data written to the stream and save it to the `body` attribute. If a deserialization function for the response's content-type is registered with `local.contentTypes`, Local.js will attempt to parse the data before emitting "end".

---

### .close()

 - returns `this`

Closes the stream, emitting the "close" event on the client.

---

### .status

The numeric response code

---

### .reason

The string response phrase

---

### .headers

The headers as set by the server

---

### .parsedHeaders

The headers parsed by `local.httpHeaders`

---

### .body

The buffered response body

---

### .body_

A promise to the response body

---

### .isConnOpen

A boolean

---

### .latency

The round-trip time from dispatch to stream close in MS

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