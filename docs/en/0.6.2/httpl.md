HTTPL: JSON encoded message streams with HTTP semantics
=======================================================

---

HTTPL is used in Local.js to communicate over Browser messaging channels (postMessage, WebRTC DataChannels). The channels offer guarantees on order and delivery which are similar to that of TCP, while HTTPL provides stream multiplexing. For unordered channels, HTTPL supports head-of-line blocking.

Unlike HTTP, HTTPL is full-duplex, meaning the request and response can stream simultaneously.

JSON encoding was chosen over HTTP's format to take advantage of the browser's native JSON library. It's a larger message format (it includes more syntax and labeling) but it parses much faster than a JS routine for HTTP does.

---

### Message Types

The format consists of 4 kinds of request messages: the header, the body chunk, the end, and the close. They are:

```javascript
// header
{
  sid: 1, // stream id
  mid: (isReorderingMessages) ? 1 : undefined, // message id
  method: 'POST', // request method
  path: '/foo?k=v', // target resource
  headers: {
    accept: 'text/html',
    'content-type': 'application/json',
    host: 'myworker.js'
  }
}
```

```javascript
// chunk
{ sid: 1, mid: (isReorderingMessages) ? ++midCounter : undefined, body: '{"foo":"bar"}' }
```

```javascript
// end
{ sid: 1, mid: (isReorderingMessages) ? ++midCounter : undefined, end: true }
```

```javascript
// close
{ sid: 1, mid: (isReorderingMessages) ? ++midCounter : undefined, close : true }
```

These messages can be combined together if the client chooses to buffer them, though at the time of this writing local.js hasn't implemented that process yet.

```javascript
{
  sid: 1,
  method: 'POST',
  path: '/foo',
  headers: {
    accept: 'text/html',
    'content-type': 'application/json',
    host: 'myworker.js'
  }
  body: '{"foo":"bar"}',
  end: true,
  close: true
}
```

The `body` attribute on chunk messages are always strings in the native encoding of the given content-type. Multiple chunk messages can be issued to spread the content across the messages sequentially.

The difference between end and close messages are subtle, but important. An end message signals the end of the request, but not the transaction. The requester is still listening for response data. The close message then signals that the client has ceased listening to the response. Typically, the server sends the close message, with an exception being server-sent event-streams, which clients often close.

The response has the same four types of messages, but with slightly different semantics. Here are all four combined:

```javascript
{
  sid: 1, // stream id
  mid: (isReorderingMessages) ? midCounter++ : undefined, // message id
  status: 200, // status code
  reason: 'Ok', // short explanation of the response
  headers: { 'content-type': 'text/html' },
  body: '<h1>success</h1>',
  end: true,
  close: true
}
```