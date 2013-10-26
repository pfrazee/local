Intro: TodoSOA
==============

[<a href="http://grimwire.com/todosoa">Live Demo</a> | <a href="https://github.com/grimwire/todosoa">Source Code</a>]

---

TodoSOA is based on the <a href="http://todomvc.com">TodoMVC example</a> for VanillaJS. It has the same functionality, but uses Local.js servers in the document and in Web Workers. Its <a href="https://github.com/grimwire/todosoa">source has been annotated</a> to help familiarize you with Local.js.

### About the design

TodoSOA breaks its components into services hosted on the page. The responsibilities are similar to that of MVC - there's storage, view-generation, and a coordinator - but they communicate only by passing messages. Agents are used in lieu of object references.

The advantage of this design is the loose coupling. The storage service, for example, could be moved into a Web server, and the application would only have to update the URL given to the storage agent. In more advanced applications, this can be used to change the program's behavior or share components among multiple live users.

The three servers in TodoSOA are:

 - `httpl://storage` a LocalStorage wrapper in the document.
 - `httpl://view.js` a template renderer in a worker.
 - `httpl://todo` the main application host in the document.

This page steps through notable parts of the source. <a href="https://github.com/grimwire/todosoa">Visit the repository</a> to see the full application.


## /js/app.js - The starting point

### Setup

```javascript
local.setDispatchWrapper(function(req, res, dispatch) {
	// Dispatch the request, wait for a response, then log both
	dispatch(req, res).always(console.log.bind(console, req));
});
```

The dispatch wrapper is an optional middleware that is injected between `dispatch()` and delivery of the request. It's used here for logging.

<a href="#docs/api/setdispatchwrapper.md">&raquo; setDispatchWrapper()</a>

---

```javascript
local.spawnWorkerServer('js/view.js');
```

This will create a worker using 'js/view.js' and assign it to 'httpl://view.js'. All requests to that address will buffer until the script has loaded.

<a href="#docs/api/managing_servers.md">&raquo; spawnWorkerServer()</a>

---

```javascript
local.addServer('storage', new app.Store(name));
local.addServer('todo', new app.Host('httpl://storage', 'httpl://view.js'));
```

Both of these servers will live in the document (at 'httpl://storage' and 'httpl://todo', respectively). The addServer call takes the desired domain name, then a function or object. If an object is given, it should descend from `local.Server.prototype`.

<a href="#docs/api/managing_servers.md">&raquo; addServer()</a>

---

```javascript
var todoApi = local.agent('httpl://todo');
```

Agents are like database cursors for Web APIs. We'll use `todoApi` to send requests to the 'todo' server while avoiding any URL construction.

<a href="#docs/api/agent.md">&raquo; agent()</a>

---

### DOM Events


```javascript
// When the enter key is pressed fire the addItem process.
$$('#new-todo').addEventListener('keypress', function (e) {
	var title = e.target.value.trim();
	if (e.keyCode === 13 && title !== '') {
		// Send a POST to create a new item.
		todoApi.post({ title: title, completed: 0 });
		e.target.value = '';
	}
});
```

Agents include dispatch sugars for common request methods (head, get, post, put, patch, delete, notify). In all requests, if no content-type is specified, 'application/json' will be assumed for objects and 'text/plain' will be assumed for strings.

---

A utility function is defined which shows how agents move between resources:

```javascript
function lookupResource(target) {
	while (target.nodeName !== 'LI') {
		target = target.parentNode;
	}
	return todoApi.follow({ rel: 'item', id: target.dataset.id });
}
```

Agent navigations work by issuing HEAD requests to their starting locations and searching through the responses' Link headers. The searches are specified in queries given to `follow()`, as above. This query will find the first link with a `rel` that **includes** `'item'` and an `id` that **equals** `target.dataset.id`.

<span class="muted">Reltypes are a special part of queries; read more about them in the <a href="#docs/api/agent.md">Agent documentation</a>.</span>

Here is how `lookupResource` gets used:

```javascript
// A delegation event. Will check what item was clicked whenever you click on any
// part of a list item.
$$('#todo-list').addEventListener('click', function (e) {
	// If you click a destroy button
	if (e.target.className.indexOf('destroy') > -1) {
		// Find the matching resource and send a DELETE request
		lookupResource(e.target).delete();
	}

	// If you click the checkmark
	if (e.target.className.indexOf('toggle') > -1) {
		// Find the matching resource and send a CHECK/UNCHECK request
		var method = (e.target.checked) ? 'CHECK' : 'UNCHECK';
		lookupResource(e.target).dispatch({ method: method });
	}
});
```
<br/>

## /js/todo.js - The central control

### Constructor

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

	// ...
}

// Inherit from the local.Server prototype
Todo.prototype = Object.create(local.Server.prototype);
```

The Todo server creates agents that point to the storage and the different views. DOM event handlers in js/app.js generate requests to the todo server, which then sends requests to storage and views to update the data and UI.

<a href="#docs/api/server.md">&raquo; Server</a>

---

### Rendering

The render process illustrates how requests can be dispatched between multiple hosts and synced.

```javascript
// Fetch the active items from storage
this.storageApi.dispatch({ method: 'GET', query: { completed: 0 } })
	.then(function(res) {
		var items = res.body;

		// Send render GET requests for each item
		var responses_ = [];
		items.forEach(function(item) {
			var query = { item_id: item.id, title: item.title, completed: item.completed };
			var response_ = self.listItemView.dispatch({ method: 'GET', query: query });
			responses_.push(response_);
		});

		// Bundle the responses into one promise
		return local.promise.bundle(responses_);
	})
	.then(function(ress) {
		// Render the HTML to the page
		self.$todoList.innerHTML = ress.map(function(res) { return res.body; }).join('');
	});
```


The view server generates HTML using GET requests. In the case of the list-render (above) this can create multiple requests which require syncing. This is handled with `promise.bundle()`.

<a href="#docs/api/promises.md">&raquo; Promises</a>

---

## /js/view.js - The templating worker

### Setup

Workers are given the additional `local.worker` object to configure themselves.

```javascript
local.worker.setServer(function (req, res, page) {
```

The third parameter, `page`, is relevant for a SharedWorker, as they can receive requests from multiple pages. In this case, `page` will always be the origin TodoSOA instance.

---

### Server

Templates are rendered by path:

```javascript
// Only accept HEAD and GET requests
if (req.method != 'HEAD' && req.method != 'GET') {
	return res.writeHead(405, 'bad method').end();
}

// Route by path
switch (req.path) {
	case '/':
		// Toplevel resource, respond with the link header
		res.setHeader('link', [
			{ href: '/', rel: 'self collection service', title: 'TodoSOA HTML Generator' },
			{ href: '/listitem{?item_id,title,completed}', rel: 'item', id: 'listitem' },
			{ href: '/counter{?active}', rel: 'item', id: 'counter' },
			{ href: '/clearbtn{?completed}', rel: 'item', id: 'clearbtn' }
		]);
		res.writeHead(204, 'ok, no content').end();
		break;

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

	// ...

	default:
		res.writeHead(404, 'not found').end();
}
```

Node.js developers should feel somewhat at ease with Local.js servers, though the APIs are not exact copies. Request and response objects behave as streams, and can not change headers after dispatch (for requests) or writeHead (for responses). In this case, we don't wait for the request stream to end, as GET requests do not have bodies.

A word on the link headers. Some headers have parsers and stringifiers registered in `httpHeaders` which allow you to use object formats. The 'link' header is one such case. Additionally, link headers can use URI Templates to specify parameters in the path or query. The navigator makes use of this by filling the tokens with values in its `follow()` queries. Read more about this in the <a href="#docs/api/agent.md">Agent</a> documentation.

<a href="#docs/api/request.md">&raquo; Request</a>, <a href="#docs/api/response.md">&raquo; Response</a>, <a href="#docs/api/httpheaders.md">&raquo; httpHeaders</a>, <a href="#docs/api/agent.md">&raquo; agent()</a>

---

## Next Steps

This should give a general idea of how Local.js apps operate. I recommend you browse through the <a href="//github.com/grimwire/todosoa">full source of TodoSOA</a> to get a more complete understanding of its architecture.

Message-passing is not always the ideal design for applications. It requires some additional boiler-plate, syncing steps, and introduces calling latency. However, the high degree of separation can be advantageous to large applications which need to evolve over time, and the common protocol opens much greater opportunities for parallelism and distributed applications. In some cases, message-driven applications can also enable users to configure where data is stored or how an application behaves.

Continue reading to get a better understanding of the strengths and weaknesses:

 - <a href="#docs/example_mdviewer.md">Example: Markdown Viewer</a>
 - <a href="#docs/grimwire.md">Using Grimwire</a>