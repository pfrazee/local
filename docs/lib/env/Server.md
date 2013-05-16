```javascript
local.env.getServer('myhost.usr').terminate();
```

<br/>
### local.env.Server

The base prototype for server objects. Should be inherited by any object that serves locally.

<br />
#### local.env.Server#handleHttpRequest( <small>request, response</small> ) <small>=> undefined</small>

Request handler, should be overwritten by subprototypes.

<br />
#### local.env.Server#terminate() <small>=> undefined</small>

Called before server destruction, should be overwritten by subprototypes. Executes syncronously - does not wait for cleanup to finish.