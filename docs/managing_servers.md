Managing Servers
================

---

```javascript
local.addServer('foo', function(req, res) { /* ... */ });
local.addServer('bar', new BarServer());
local.spawnWorkerServer('/js/myworker.js');
local.joinRelay('https://myrelay.com');
```

### local.addServer(domain, server, <span class="muted">context</span>)

 - `domain`: required string, the hostname to assign
 - `server`: required function|local.Server
 - `context`: optional object, the object to use as 'this' in the server function

Adds the server object/function to the local hostmap. Any requests with a matching hostname will be routed to the given function.

If an object is given, its prototype must descend from `local.Server`, and it should implement `handleLocalRequest`.

### local.spawnWorkerServer(src, <span class="muted">config</span>, <span class="muted">serverFn</span>)

 - `src`: required string, the URL to the worker source. Can be a data-URI of type application/javascript.
 - `config`: optional object, sent to the worker after load and assigned to `local.worker.config`.
 - `config.domain`: optional string, overrides the automatic domain generation
 - `config.shared`: boolean, should the workerserver be shared?
 - `config.namespace`: optional string, what should the shared worker be named?
   - defaults to `config.src` if undefined
 - `serverFn`: optional function, a handler for requests from the worker
 - returns `local.WorkerBridgeServer`

Creates a Web Worker and a bridge server to the worker. Generates a local hostname using the filename (/js/myworker.js -> httpl://myworker.js).

### local.joinRelay(providerUrl, <span class="muted">config</span>, <span class="muted">serverFn</span>)

 - `providerUrl`: optional string, the relay provider
 - `config.app`: optional string, the app to join as (defaults to window.location.host)
 - `config.sid`: optional number, the stream id (defaults to pseudo-random)
 - `config.ping`: optional number, sends a keepalive ping to self via the relay at the given interval (in ms)
   - set to false to disable keepalive pings
   - defaults to 45000
 - `config.retryTimeout`: optional number, time (in ms) before a peer connection is aborted and retried (defaults to 15000)
 - `config.retries`: optional number, times to retry a peer connection before giving up (defaults to 5)
 - `serverFn`: optional function, a response generator for requests from connected peers
 - returns `local.Relay`

Creates a `local.Relay` for opening a signalling stream and accepting WebRTC peers.

### local.removeServer(domain)

 - `domain`: required string

Removes the server registered at the given hostname.

### local.getServer(domain)

 - `domain`: required string
 - returns `{ fn:, context: }`

Gets the server registered at the given hostname.

### local.getServers()

 - returns `[{ fn:, context: }, ...]`

Get the entire local hostmap.