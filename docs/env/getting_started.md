Getting Started
===============

pfraze 2013

[...]

## Services

A defining quality for the environment is the tools it provides its applications. The Workers are isolated except for the requests they issue; the responses can come from anywhere, but, ultimately, the environment must deliver them.

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


## Application Management

[...]

```javascript
var personaServer = new PersonaServer();
Environment.addServer('user.env', personaServer);

Environment.addServer('placard.app', new Environment.WorkerServer('/apps/social/placard.js', { dataSource:'httpl://fixtures.env/profiles/lorem.ipsum' }));
Environment.addServer('wall.app', new Environment.WorkerServer('/apps/social/wall.js', { dataSource:'httpl://fixtures.env/posts', userSource:'httpl://user.env' }));
Environment.addServer('prof-info.app', new Environment.WorkerServer('/apps/social/prof-info.js', { dataSource:'httpl://fixtures.env/profiles/lorem.ipsum' }));
```


## Layout

[...]

```javascript
Environment.addClient('#placard').request('httpl://placard.app');
Environment.addClient('#wall').request('httpl://wall.app');
Environment.addClient('#prof-info').request('httpl://prof-info.app');
```
