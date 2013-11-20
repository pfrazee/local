WorkerBridgeServer
==================

---

Descends from `local.BridgeServer`. Creates a Web Worker and provides a server interface for exchanging requests. Most applications will want to use `local.spawnWorkerServer` instead of instantiating this object directly.

```javascript
local.spawnWorkerServer('/js/myworker.js'); // => WorkerBridgeServer instance
```

### local.WorkerBridgeServer(config)

 - `config.src`: required string, the URL to the worker source. Can be a data-URI of type application/javascript.
 - `config.domain`: optional string, overrides the automatic domain generation
 - `config.shared`: boolean, should the workerserver be shared?
 - `config.namespace`: optional string, what should the shared worker be named?
   - defaults to `config.src` if undefined
 - `serverFn`: optional function, a handler for requests from the worker

If specified, `serverFn` will define the worker's `handleRemoteRequest()` behavior.

## local.WorkerBridgeServer

### .handleRemoteRequest(request, response)

 - `request`: required local.Request
 - `response`: required local.Response

Handles requests from the Worker to the page. If not overridden directly or with the `serverFn` config, will respond 500.

---

### .terminate()

Destroys the Worker.