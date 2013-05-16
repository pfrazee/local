```javascript
var registry = local.http.getLocalRegistry();
var server = registry['httpl://domain'];
server.fn.call(server.context, request, response);
```

<br/>
#### local.http.getLocalRegistry() <small>=> [{ fn, context }, ...]</small>

Gets the server functions and contexts registry.