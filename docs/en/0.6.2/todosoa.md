Tutorial: TodoSOA
=================

[<a href="http://grimwire.com/todosoa">Live Demo</a> | <a href="https://github.com/grimwire/todosoa">Source Code</a>]

---

TodoSOA is the Local.js version of <a href="http://todomvc.com">TodoMVC</a>. We're going to step through it briefly to introduce Local.js.

### The Tao of Local.js

The Tao of Local.js is to define your components as servers.

 - Rather than call functions, the components send each other requests.
 - Rather than hold references, the components keep URLs to each other.

TodoSOA has three servers:

 - `httpl://storage` is a LocalStorage wrapper.
 - `httpl://view.js` is a template renderer.
 - `httpl://todo` is the main application.

Of the three of them, only `httpl://todo` must live in the document. The other two could be moved into the document, Web Workers, or remote hosts.


### Initialization

```javascript
local.setDispatchWrapper(function(req, res, dispatch) {
	// Dispatch the request, wait for a response, then log both
	dispatch(req, res).always(console.log.bind(console, req));
});
local.spawnWorkerServer('js/view.js');
local.addServer('storage', new app.Store(name));
local.addServer('todo', new app.Host('httpl://storage', 'httpl://view.js'));
var todoApi = local.agent('httpl://todo');
```

The dispatch wrapper is an optional middleware that is injected between `dispatch()` and delivery of the request. It's used here for logging.

<a href="#docs/api/setdispatchwrapper.md">&raquo; setDispatchWrapper()</a>

The `view.js` worker will take a moment to initialize, but you can send requests to it immediately after `spawnWorkerServer` is called. Local.js will buffer the messages until the worker signals "ready."

<a href="#docs/api/managing_servers.md">&raquo; Managing Servers</a><br>

Agents are like database cursors for Web APIs. They request links from their current location, query against the link keyvalues, and construct a new location URI from the top match.

<a href="#docs/api/agent.md">&raquo; agent()</a>


### Todo Server

```javascript
function Todo(storageUrl, viewUrl) {
	// Call the local.Server constructor
	local.Server.call(this);

	// Generate agents which point toward the Storage server and View items
	var viewApi = local.agent(viewUrl);
	this.storageApi = local.agent(storageUrl);
	this.listItemView = viewApi.follow({ rel: 'item', id: 'listitem' });
	this.counterView  = viewApi.follow({ rel: 'item', id: 'counter' });
	this.clearBtnView = viewApi.follow({ rel: 'item', id: 'clearbtn' });
}

// Inherit from the local.Server prototype
Todo.prototype = Object.create(local.Server.prototype);

Todo.prototype.handleLocalRequest = function(req, res) {
	var self = this;
	/*
	Toplevel Resource
	*/
	if (req.path == '/') {
		// Set the link header
		res.setHeader('link', [
			{ href: '/', rel: 'self service collection', title: 'TodoSOA App Todo' },
			{ href: '/active', rel: 'item', id: 'active' },
			{ href: '/completed', rel: 'item', id: 'completed' },
			{ href: '/{id}', rel: 'item' },
		]);

		// Route by method
		switch (req.method) {
			case 'HEAD':
				// Send back the link header
				res.writeHead(204, 'ok, no content').end();
				break;

			case 'POST':
				// Create a new item and add it to the UI
				req.on('end', function() {
					// Add to storage
					self.storageApi.POST(req.body).then(function () {
						// Redraw
						self._filter(true);
						res.writeHead(204, 'ok, no content').end();
					}, function() {
						// Failure
						res.writeHead(500, 'internal error').end();
					});
				});
				break;

			default:
				res.writeHead(405, 'bad method').end();
		}
	}
	/*
	Individual Todo Items
	*/
	} else {
		// Extract the ID
		var id = req.path.slice(1);
		// ...
	}
};
```

Servers can be defined as either functions or objects that descend from `local.Server`. They behave similarly to Node.js servers in that:

 - Requests and responses are streams.
 - The handler is called before the request stream ends.
 - Naming conventions are similar.

However, the API is not an exact match and includes some key differences:

 - Query parameters are automatically extracted into `.query`.
 - Request headers with parsers will automatically deserialize and store in `.parsedHeaders`.
 - Response headers with serializers will automatically serialize on `.writeHead()`.
 - Content types with parsers will automatically deserialize `.body` on 'end'.

<a href="#docs/api/server.md">&raquo; Server</a>, <a href="#docs/api/httpHeaders.md">&raquo; httpHeaders</a>, <a href="#docs/api/contenttypes.md">&raquo; contentTypes</a>


### Sending Requests with Agents

```javascript
// When the enter key is pressed fire the addItem process.
$$('#new-todo').addEventListener('keypress', function (e) {
	var title = e.target.value.trim();
	if (e.keyCode === 13 && title !== '') {
		// Send a POST to create a new item.
		todoApi.POST({ title: title, completed: 0 });
		e.target.value = '';
	}
});
```

As you can see, the `todoApi` agent saves us the trouble of specifying a URL. Since we initialized it to `httpl://todo`, the requests will automatically take that URI. It also defaults the content-type to JSON, since we're sending an object.

```javascript
function lookupResource(target) {
	while (target.nodeName !== 'LI') {
		target = target.parentNode;
	}
	// Find the URI of the todo item and create a new agent that points to it
	return todoApi.follow({ rel: 'item', id: target.dataset.id });
}

// A delegation event. Will check what item was clicked whenever you click on any
// part of a list item.
$$('#todo-list').addEventListener('click', function (e) {
	// If you click a destroy button
	if (e.target.className.indexOf('destroy') > -1) {
		// Find the matching resource and send a DELETE request
		lookupResource(e.target).DELETE();
	}

	// If you click the checkmark
	if (e.target.className.indexOf('toggle') > -1) {
		// Find the matching resource and send a CHECK/UNCHECK request
		var request = { method: (e.target.checked) ? 'CHECK' : 'UNCHECK' };
		lookupResource(e.target).dispatch(request);
	}
});
```

Agent navigations work by issuing HEAD requests to their current location and searching through the responses' Link headers. The searches are specified in queries given to `follow()`, as above.

The `lookupResource()` query will find the first link with a `rel` that *includes* `'item'` and an `id` that *equals* `target.dataset.id`. The `rel` attribute is handled specially because it's a set of "relation types." Successfully matching against `rel` means that the link's reference will behave a certain way.

 > **Why bother with reltypes?**
 > Specific behaviors can be guaranteed by using URL reltypes, as the URLs can host documentation for what the reltype means. Facebook, for instance, might use `facebook.com/rel/profile` to label links with behaviors for GET, POST, PUT, etc. When configuring together components by different authors, this helps each component recognize the others and reason about their options. For internal use, however, the <a href="http://www.iana.org/assignments/link-relations/link-relations.xhtml#link-relations-1" target="_top">broadly-defined</a> 'item' is fine.

If you refer back to the Todo server's definition, you'll notice that the last entry is `{ href: '/{id}', rel: 'item' }`. This is an example of a templated link. To avoid bloating responses with full indexes, URI Templates can be used to act as "catchalls."

<a href="#docs/api/agent.md">&raquo; Agents</a>


### Rendering HTML

The main rendering behavior is defined in the Todo server. It's invoked by sending a SHOW method to `/all`, `/active`, or `/completed`.

Experienced Web developers may find it odd that:

 - The atypical "SHOW" method is used,
 - The DOM is manipulated from a server.

However, remember that `httpl://todo` is a server for operating the document - not for hosting content. Were the page networked (eg with WebRTC) then access to `http://todo` would allow remote operation of the page.

```javascript
/* Within the SHOW handler */
// Fetch the items from storage, filtered down to the set implied by our ID
var query = {};
if (id == 'active') { query.completed = 0; }
else if (id == 'completed') { query.completed = 1; }
this.storageApi.dispatch({ method: 'GET', query: query })
	.then(function(res2) {
		var items = res2.body;
		var responses_ = [];
		items.forEach(function(item) {
			var query = { item_id: item.id, title: item.title, completed: item.completed };
			// Send to view.js to be rendered
			responses_.push(self.listItemView.GET({ query: query }));
		});
		// Bundle the responses into one promise that will fulfill when all promises fulfill or reject
		return local.promise.bundle(responses_);
	})
	.then(function(res3s) {
		// Render the HTML to the page
		self.$todoList.innerHTML = res3s.map(function(res3) { return res3.body; }).join('');
		res.writeHead(204, 'ok, no content').end();
	});
```

This code is made inefficient to illustrate the 'bundling' feature of promises: rather than send all the items in one request to be rendered, they are sent individually and combined into one promise. This is a common pattern for syncing multiple requests.

<a href="#docs/api/promises.md">&raquo; Promises</a>

The view server runs in a Worker (also for illustrative purposes):

```javascript
importScripts('local.js');
var listItemTemplate
=	'<li data-id="{{item_id}}" class="{{completed}}">'
+		'<div class="view">'
+			'<input class="toggle" type="checkbox" {{checked}}>'
+			'<label>{{title}}</label>'
+			'<button class="destroy"></button>'
+		'</div>'
+	'</li>';
local.worker.setServer(function (req, res, page) {
	// Only accept HEAD and GET requests
	if (req.method != 'HEAD' && req.method != 'GET') {
		return res.writeHead(405, 'bad method').end();
	}

	// Route by path
	switch (req.path) {
		/* ... */

		case '/listitem':
			// Creates an <li> HTML string and returns it for placement in your app
			res.setHeader('link', [
				{ href: '/', rel: 'up collection service', title: 'TodoSOA HTML Generator' },
				{ href: '/listitem{?item_id,title,completed}', rel: 'self item', id: 'listitem' }
			]);

			if (req.method == 'HEAD') {
				return res.writeHead(204, 'ok, no content').end();
			}

			template = listItemTemplate
				.replace('{{item_id}}', req.query.item_id)
				.replace('{{title}}', req.query.title)
				.replace('{{completed}}', (req.query.completed) ? 'completed' : '')
				.replace('{{checked}}', (req.query.completed) ? 'checked' : '');

			res.writeHead(200, 'ok', { 'content-type': 'text/html' }).end(template);
			break;

		/* ... */

		default:
			res.writeHead(404, 'not found').end();
	}
});
```

Under light load, workers will typically respond to requests (roundtrip) within 1 ms. Because they are sandboxed in their own VMs and kept in a separate thread from the document, they are ideal for hosting user-submitted (untrusted) components. If we wanted, we could let the user set the code for view.js and let them choose how to render the page.

Any access to the page from a worker occurs through a server function in the document thread. However, because TodoSOA did not set a server function for view.js in `spawnWorkerServer()`, the worker is only able to host.


### Storing Data

To help solidify your concept of how Local.js servers behave, have a look at the storage server:

```javascript
Store.prototype.handleLocalRequest = function(req, res) {
	/*
	Toplevel Resource
	*/
	if (req.path == '/') {
		// Set the link header
		res.setHeader('link', [
			{ href: '/{?completed}', rel: 'self service collection', title: 'TodoSOA Storage' },
			{ href: '/{id}', rel: 'item' }
		]);

		// Route by method
		switch (req.method) {
			case 'HEAD':
				// Send back the link header
				res.writeHead(204, 'ok, no content').end();
				break;

			case 'GET':
				// Fetch all items. Can be filtered with ?query=[1|0]
				this.findAll(function(data) {
					if (typeof req.query.completed != 'undefined') {
						data = data.filter(function(item) {
							return item.completed == req.query.completed;
						});
					}
					res.writeHead(200, 'ok', {'content-type': 'application/json'}).end(data);
				});
				break;

			case 'COUNT':
				// Count all items
				var counts = {
					active: 0,
					completed: 0,
					total: 0
				};

				this.findAll(function (data) {
					data.each(function (todo) {
						if (todo.completed) {
							counts.completed++;
						} else {
							counts.active++;
						}

						counts.total++;
					});
				});

				res.writeHead(200, 'ok', {'content-type': 'application/json'}).end(counts);
				break;

			case 'POST':
				// Add a new item
				req.on('end', (function() { // wait until the stream has finished.
					this.save(req.body, function(newTodo) {
						res.writeHead(201, 'created', { location: '/'+newTodo.id }).end();
					});
				}).bind(this));
				break;

			case 'DELETE':
				// Delete all items
				this.drop();
				res.writeHead(204, 'ok, no content').end();
				break;

			default:
				res.writeHead(405, 'bad method').end();
				break;
		}
	}
	/*
	Item Resource
	*/
	else {
		// Extract the id from the request path.
		var id = req.path.slice(1);

		// Set the link header
		res.setHeader('link', [
			{ href: '/{?completed}', rel: 'up service collection', title: 'TodoSOA Storage' },
			{ href: '/'+id, rel: 'self item', id: id }
		]);

		// Route by method
		switch (req.method) {
			case 'HEAD':
				// Send back the link header
				res.writeHead(204, 'ok, no content').end();
				break;

			case 'GET':
				// Get the content of the item
				this.find({ id: id }, function(data) {
					if (data[0]) {
						res.writeHead(200, 'ok', {'content-type': 'application/json'}).end(data[0]);
					} else {
						res.writeHead(404, 'not found').end();
					}
				});
				break;

			case 'PUT':
				// Update the item
				req.on('end', (function() {
					this.save(id, req.body, function() {
						res.writeHead(204, 'ok, no content').end();
					});
				}).bind(this));
				break;

			case 'DELETE':
				// Delete the item
				this.remove(id, function() {
					res.writeHead(204, 'ok, no content').end();
				});
				break;

			default:
				res.writeHead(405, 'bad method').end();
				break;
		}
	}
};
```

As with most HTTP servers, building the server with the base API is tedious. For something a little nicer, try the <a href="https://github.com/pfraze/servware" title="Servware">Servware framework</a>.

### Summary

To review, TodoSOA uses 3 servers - one for app logic, one for data storage, and one for template rendering. We used Agents to communicate between components, Link headers to automate URI construction, and a Worker to parallelize HTML generation.

Compared to some of the MVC approaches in Javascript, TodoSOA is not as simple or convenient. Local.js has very different goals than Backbone or Knockout. It is designed to decouple the application into components which can be changed at runtime by users. However, closed-development applications can still benefit of reusability and reconfigurability gained by message passing.

> A recommended addition since the writing of this tutorial is <a href="#docs/api/bindrequestevents.md">Request Events</a>, which offer a convenient alternative to event listening.