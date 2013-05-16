```javascript
local.http.dispatch({
  method: 'get',
  url: 'http://myhose.com/feed',
  headers: { accept:'text/plain' },
  stream: true
}).succeed(function(res) {
    console.log('stream opened', res.status, res.reason, res.headers);
    res.on('data', function(e) {
      console.log(e.data);
    });
    res.on('end', function(e) {
      console.log('stream closed');
    });
  });
```

<br/>
### local.http.ClientResponse

The prototype for objects provided by `local.http.dispatch()`. Typically should not be instantiated directly. Inherits from `local.util.EventEmitter`.

 - Attributes:
   - `status` number
   - `reason` string
   - `headers` object
   - `body` (populated at fulfill if the request is dispatched with a falsey or undefined `stream` option)
   - `isConnOpen` boolean, indicates if the response stream has been closed yet

<br/>
Emits the following events:

#### "data" 
A new chunk of data has arrived

#### "end" 
The connection was ended by the server

#### "close"
The connection has been closed
