Building In-Document Servers
============================

pfraze 2013


## Overview

In-document servers are extensions to the environment for use by user applications. They tend to provide mediated access to document features (such as local storage) and to the environment itself (such active servers and session data).

 > Note: In-document servers are not sandboxed, and should not be used if not trusted.

To build an in-document server, build a descendent prototype to `local.env.Server` and override `handleHttpRequest` with a custom handler. Except for living in the document namespace, they behave exactly as Worker servers.

```javascript
function CustomEnvironmentServer() {
	local.env.Server.call(this);
}
CustomEnvironmentServer.prototype = Object.create(local.env.Server.prototype);
CustomEnvironmentServer.prototype.handleHttpRequest = function(request, response) {
	response.writeHead(200, 'ok');
	response.end();
};
```

You may also wish to override `terminate()` if you wish to add deconstruction behavior.