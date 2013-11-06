httpl://hosts
=============

---

Local.js includes a 'hosts' server which responses to HEAD and GET requests with links to the active local hosts.

```javascript
local.addServer('foobar', function(req, res) {
	res.writeHead(204, 'ok', {
		link: [{ href: '/', rel: 'self service', id: 'helloworld' }],
		'content-type': 'text/plain'
	});
	res.end('Hello, World!');
});
local.agent('httpl://hosts')
	.follow({ rel: 'service', id: 'helloworld' })
	.get();
```

On every request, hosts will dispatch a HEAD to every local server and extract the links with a 'self' reltype. If a server doesn't provide any 'self' link, hosts will add a simple default.