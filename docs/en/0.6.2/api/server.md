Server
======

---

The base prototype for server objects.

```javascript
function MyServer(config) {
	local.Server.call(this, config);
}
MyServer.prototype = Object.create(local.Server.prototype);

MyServer.prototype.handleLocalRequest(req, res) {
	res.writeHead(204, 'ok, no content');
	res.end();
}
```

## local.Server

### .handleLocalRequest( <small>request, response</small> ) <small>=> undefined</small>

Request handler, should be overridden by subtypes.

---

### .terminate()

Teardown handler, should be overridden by subtypes.

---

### .getDomain()

 - returns string, the registered hostname of the server instance

---

### .getUrl()

 - returns string, the full URL of the server instance

---

### .config

An object, contains values in the constructor's config object.

 - `config.domain`: the hostname given to the server by `local.addServer()`