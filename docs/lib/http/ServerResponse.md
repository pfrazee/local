```javascript
function main(request, response) {
  response.setHeader('link', [
    { rel:'self', href:'/' }
  ]);
  response.writeHead(200, 'ok', { 'content-type': 'text/html' });
  response.end('<h1>Hello, World!</h1>');
}
```

<br/>
### local.http.ServerResponse

The prototype for the response objects provided to request handlers. Typically should not be instantiated directly. Inherits from `local.util.EventEmitter`.

<br/>
#### local.http.ServerResponse#writeHead( <small>status, reason, [headers]</small> ) <small>=> this</small>

Initiates the response transmission. After calling this function, headers can not be altered.

<br/>
#### local.http.ServerResponse#setHeader( <small>header, value</small> ) <small>=> undefined</small>

<br/>
#### local.http.ServerResponse#getHeader( <small>header</small> ) <small>=> string</small>

<br/>
#### local.http.ServerResponse#removeHeader( <small>header</small> ) <small>=> undefined</small>

<br/>
#### local.http.ServerResponse#write( <small>data</small> ) <small>=> this</small>

Writes data to the response. If streaming, this will notify the client.

 - If the data and the existing response body are strings, will concatenate onto the buffered response body.
 - Otherwise, overwrites the current body value

<br/>
#### local.http.ServerResponse#end( <small>[data]</small> ) <small>=> this</small>

Closes the response, writing `data` if provided.


<br/>
Emits the following events:

#### "close"
The connection has been closed