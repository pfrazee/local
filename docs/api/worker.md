local.worker
============

---

Worker environments are provided with an extra `local.worker` object for handling Worker-specific tasks. It provides an EventEmitter interface, page management, logging, and configuration.

```javascript
local.worker.setServer(function(req, res, page) {
	// ...
});
local.worker.on('connect', function(page) {
	console.log('page '+id+' has connected');
});
```

If the worker is shared, the originating page is considered the "Host" and given elevated privileges.

`local.PageServer` instances are automatically created and assigned a URL when a page connects. The URL follows the scheme of `<page_id>.page`. For instance, the hostpage can be reached at 'httpl://0.page'.

---

### console.log(args...)

Approximates standard `console.log`. Also supports:

 - `dir()`
 - `debug()`
 - `warn()`
 - `error()`

---

### local.worker.setServer(server)

 - `server`: required function|local.Server

Sets the server function for handling requests from the pages.

---

### local.worker.config

Populated with the config object from the host page's WorkerBridgeServer.

**Note**, this value is populated with a message and will not be available during load.

### local.worker.pages

An array of the connected `local.PageServer` instances.

---

### "connect" event

```
function (page) { }
```

Emitted on page-connect. Useful for SharedWorkers, which can accept multiple page connections.