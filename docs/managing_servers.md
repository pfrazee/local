Managing Servers
================

---

```javascript
local.addServer('foo', function(req, res) { /* ... */ });
local.addServer('bar', new BarServer());
local.dispatch('httpl://foo');
```

### local.addServer(domain, server, <span class="muted">context</span>)

 - `domain`: required string, the hostname to assign
 - `server`: required function|local.Server
 - `context`: optional object, the object to use as 'this' in the server function

Adds the server object/function to the local hostmap. Any requests with a matching hostname will be routed to the given function.

If an object is given, its prototype must descend from `local.Server`, and it should implement `handleLocalRequest`.

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