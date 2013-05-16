```javascript
var server = local.http.getLocal('httpl://domain');
server.fn.call(server.context, request, response);
```

<br/>
#### local.http.getLocal( <small>domain</small> ) <small>=> { fn, context }</small>

Gets the server function and context at the given domain.