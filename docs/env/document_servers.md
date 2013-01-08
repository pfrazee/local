Building In-Document Servers
============================

pfraze 2013

In-document servers must implement the following minimal functionality:

```javascript
function CustomEnvironmentServer() {
	Environment.Server.call(this);
	this.state = Environment.Server.ACTIVE;
}
CustomEnvironmentServer.prototype = Object.create(Environment.Server.prototype);
CustomEnvironmentServer.prototype.handleHttpRequest = function(request, response) {
	response.writeHead(200, 'ok');
	response.end();
};
```

They may also wish to override `terminate()` if they wish to add deconstruction behavior.


## Further Topics

 - [Using LinkJS, the HTTP wrapper](../lib/linkjs.md)
 - [env/localstorage.js](../examples/localstorage.md)
 - [env/persona.js](../examples/persona.md)
 - [env/reflector.js](../examples/reflector.md)