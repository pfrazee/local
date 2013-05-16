```javascript
local.env.getServer('myhost.usr').loadUserScript();
```

<br/>
### local.env.WorkerServer

The prototype for worker-driven server objects.

<br />
#### local.env.Server#handleHttpRequest( <small>request, response</small> ) <small>=> undefined</small>

Request handler, dispatches to the Worker for a response.

<br />
#### local.env.Server#loadUserScript() <small>=> undefined</small>

 - If the Worker is ready for the user script, sends the script to the Worker.
 - Otherwise, flags to load the user script once the Worker is ready.

<br />
#### local.env.Server#terminate() <small>=> undefined</small>

Called before server destruction, terminates the Worker and marks the server as dead.

<br />
#### local.env.Server#getSource() <small>=> local.Promise(local.http.ClientResponse)</small>

Fetches the user script's source code.