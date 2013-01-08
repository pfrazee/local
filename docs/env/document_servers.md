Building In-Document Servers
============================

pfraze 2013

[...] custom servers

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