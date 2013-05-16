```javascript
local.env.getServer('markdown.util').config;
// => { domain: 'markdown.util', ...}
```

<br/>
#### local.env.getServer( <small>domain</small> ) <small>=> local.env.Server</small>

Takes a `domain` string, returns the registered `local.env.Server` object.