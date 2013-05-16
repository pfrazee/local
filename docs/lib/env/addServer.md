```javascript
local.env.addServer('markdown.util', new local.env.WorkerServer({
  src: '../servers/worker/markdown.js',
  baseUrl: 'http://myhost.com/docs/'
}));
```

<br/>
#### local.env.addServer( <small>domain</small>, <small>server</small> ) <small>=> server</small>

Takes a `domain` string and a `server` local.env.Server object. Registers the server in the environment and in the http router.