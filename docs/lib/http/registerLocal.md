```javascript
local.http.registerLocal('httpl://domain', function(request, response) {
  response.writeHead(200, 'ok').end();
});
```

<br/>
#### local.http.registerLocal( <small>domain, serverFn, [context]</small> ) <small>=> undefined</small>

Adds the `serverFn` function (with an optional "this" `context`) to the registry at the specified `domain`.