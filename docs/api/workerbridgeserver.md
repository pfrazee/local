WorkerBridgeServer
==================

---

Descends from `local.BridgeServer`. Creates a Web Worker and provides a server interface for exchanging requests. Most applications will want to use `local.spawnWorkerServer` instead of instantiating this object directly.

```javascript
local.spawnWorkerServer('/js/myworker.js'); // => WorkerBridgeServer instance
```

### local.WorkerBridgeServer(config)

 - `config.src`: optional string, the URL to the worker source. Required unless `config.domain` is given
 - `config.domain`: optional string, overrides the automatic domain generation
   - If given in place of `config.src`, must include a source-path in order to fetch the worker
 - `config.temp`: boolean, should the workerserver be destroyed after it handles its requests?
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