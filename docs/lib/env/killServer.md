```javascript
local.env.killServer('markdown.util');
```

<br/>
#### local.env.killServer( <small>domain</small> ) <small>=> undefined</small>

Takes a `domain` string. Unregisters the server from the environment and from the http router, and calls the server's `terminate()` function.