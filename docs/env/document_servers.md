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


### Server.state

`state` is used to track server life-cycle, particularly for Worker servers. It has three possible values:

```javascript
Environment.Server.BOOT   = 0; // initial, not ready to do work
Environment.Server.ACTIVE = 1; // server may handle requests
Environment.Server.DEAD   = 2; // should be cleaned up
```


## Server Tools

 > This section is duplicated in [Building an Application](../apps/building.md)



## Further Topics

 - [Using LinkJS, the HTTP wrapper](../lib/linkjs.md)
 - [env/localstorage.js](../examples/localstorage.md)
 - [env/persona.js](../examples/persona.md)
 - [env/reflector.js](../examples/reflector.md)