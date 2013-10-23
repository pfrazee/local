Intro: TodoSOA
==============

[<a href="http://grimwire.com/todosoa">Live Demo</a> | <a href="https://github.com/grimwire/todosoa">Source Code</a>]

TodoSOA is based on the <a href="http://todomvc.com">TodoMVC example</a> for VanillaJS. It uses two in-document servers and one worker server:

 - `httpl://storage`: a LocalStorage wrapper in the document.
 - `httpl://view.js`: a template renderer in a worker.
 - `httpl://todo`: the main application host.

This page steps through notable parts of the source. <a href="https://github.com/grimwire/todosoa">Visit the repository</a> to see the full application.


## /js/app.js - The starting point

### Setup

The application's first steps are to spawn its servers and bind DOM events. Before it does that, however, it adds some tooling:

```javascript
/**
 * Set the dispatch wrapper.
 *
 * ABOUT
 * The dispatch wrapper is a middleware between calls to local.dispatch() and the actual
 * message being sent. It can be used for setting global policies such as:
 *  - Logging
 *  - Caching strategies
 *  - Traffic rerouting
 *  - Permissioning
 *  - Formatting and sanitizing
 *
 * Make sure that all requests eventually receive a response, even if the request is not
 * passed on to the given dispatch function.
 */
local.setDispatchWrapper(function(req, res, dispatch) {
	// Dispatch the request, wait for a response, then log both
	dispatch(req, res).always(console.log.bind(console, req));
});
```

You don't have to set a dispatch wrapper, but it's handy for things like logging, which is what we're doing here.

---

Next, we define a prototype function `Todo` which initiates the main components of the app (the servers).

```javascript
/**
 * Sets up a brand new Todo list.
 *
 * @param {string} name The name of your new to do list.
 */
function Todo(name) {
	/*
	Load the view server into a Web Worker.

	ABOUT
	local.spawnWorkerServer() first loads local.js into the worker from the given
	"bootstrapUrl". This is so sandboxing policies can take place
	(an experimental feature).

	The target script path should be given relative to the bootstrapUrl. When loaded,
	the worker is assigned an httpl:// address according to the script's filename.
	In this case, the worker will be given the url 'httpl://view.js'.

	Note, any requests sent to httpl://view.js before it loads will be buffered and
	delivered when ready.
	*/
	local.spawnWorkerServer('view.js', { bootstrapUrl: 'js/local.js' });
```

It's not necessary to run the view-server from a worker; it was done here as an example.

---

The other two servers have to run in the document, because they rely on document APIs.

```javascript
	/*
	Load the storage and main app host into the document.

	ABOUT
	local.addServer() can take a function, or an object that descends from
	local.Server.prototype. In the latter case, a `config` object is added
	to the server with a `domain` attribute.
	*/
	local.addServer('storage', new app.Store(name));
	local.addServer('todo', new app.Host('httpl://storage', 'httpl://view.js'));
```

---

Final step:


```javascript
	/*
	Create an agent pointing toward the application host server.

	ABOUT
	`this.api` is a headless browser pointing to 'httpl://todo'. Any requests dispatched
	from it can ignore the `url` parameter. Using links in the response headers, `this.api`
	can find other URLs on the app host and spawn agents to them as well.
	*/
	this.api = local.agent('httpl://todo');
}
```

Agents are a good tool for interoperating with services because they handle URI-construction through links. They are used throughout TodoSOA for convenience.

---

And kick things off by creating our `Todo`:

```javascript
var todo = new Todo('todos-localjs');
```

---

### DOM Events

A utility function is defined next which shows how agents move between resources:

```javascript
/**
 * Finds the model ID of the clicked DOM element and spawns an agent pointing to
 * its resource.
 *
 * @param {object} target The starting point in the DOM for it to try to find
 * the ID of the model.
 */
function lookupResource(target) {
	while (target.nodeName !== 'LI') {
		target = target.parentNode;
	}
	/*
	Search links provided by 'httpl://todo' for the first which includes the 'item' value
	in the `rel` attribute, and which has the given value for the `id`.

	ABOUT
	Agent `follow()` calls spawn new agents with a reference to the parent agent. When
	the created agent makes a request, it will `resolve()` its query by searching the
	parent agent for a matching link. Once a URL is found, it is cached, and subsequent
	requests will go to that URL (until told to `unresolve()`).

	This makes it possible to chain `follow()` calls to describe multiple navigations,
	then trigger resolution as needed. If any parent agent fails to resolve, the error
	will propagate to the final child.
	*/
	return todo.api.follow({ rel: 'item', id: target.dataset.id });
}
```

---

You can see how this functions in the 'click' handler for the todo list:

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

---

Requests to the 'httpl://todo' toplevel is illustrated by the enter-key handler:

```javascript
// When the enter key is pressed fire the addItem method.
$$('#new-todo').addEventListener('keypress', function (e) {
	var title = e.target.value.trim();
	if (e.keyCode === 13 && title !== '') {
		/*
		Send a POST to the app host to create a new item.

		Note, we're assuming success and discarding the response since
		httpl://todo updates the UI.
		*/
		todo.api.post({ title: title, completed: 0 });
		e.target.value = '';
	}
});
```

---

## /js/store.js - the localStorage wrapper

### The Constructor

```javascript
/**
 * Creates a new client side storage object and will create an empty
 * collection if no collection already exists.
 *
 * @param {string} name The name of our DB we want to use
 * @param {function} callback Our fake DB uses callbacks because in
 * real life you probably would be making AJAX calls
 */
function Store(name, callback) {
	// Call the local.Server constructor
	local.Server.call(this);
	callback = callback || function () {};
	this._dbName = name;

	if (!localStorage[name]) {
		localStorage[name] = JSON.stringify({ todos: [] });
	}

	callback.call(this, JSON.parse(localStorage[name]));
}

// Inherit from the local.Server prototype
Store.prototype = Object.create(local.Server.prototype);
```

Any object that is given to `local.addServer()` needs to inherit from `local.Server.prototype` and call `local.Server` on itself. If the prototype-chain doesn't match, Local will throw an error.

---

### The Server Function

Server objects also need to implement `handleLocalRequest()`, or they will always respond 500:

```javascript
/**
 * Generates a response to requests from within the application.
 *
 * @param {local.Request} req The request stream
 * @param {local.Response} req The response stream
 *
 * ABOUT
 * Requests sent by `local.dispatch()` to this server's address will arrive here
 * along with a response object.
 */
Store.prototype.handleLocalRequest = function(req, res) {
	/*
	Toplevel Resource
	*/
	if (req.path == '/') {
		/*
		Set the link header

		ABOUT
		The link header has de/serialization functions registered in
		`local.httpHeaders`, allowing you to set the header in object or
		string format. When serialized, the header will look like this:

		Link: </{?completed}>; rel="self service collection"; title="TodoSOA Storage", </{id}>; rel="item"

		Local supports the URI Template spec in the `href` value of links,
		allowing servers to specify parameters rather than precise values.
		If a `local.Agent` queries with { rel: 'item', id: 'listitem' },
		the `id` will match the token and fill in the value. Link headers are
		order-significant, so it's common to put links with specific values
		at top, then put the URI Templated links beneath.

		Note that Local will automatically prepend the domain to the URLs
		provided in links if they are given as relative paths.
		*/
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

				/*
				Wait until the stream has finished.

				ABOUT
				Requests are send to servers before their content has been delivered.
				If you want to handle each chunk as it arrives, you can subscribe to
				the 'data' event.

				The Request object automatically buffers the streamed content and
				deserializes it when the stream finishes. The parsing is handled by
				`local.contentTypes`, which selects the parser according to the
				Content-Type header.
				*/
				req.on('end', (function() {
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
		/*
		Extract the id from the request path.

		ABOUT
		The req.path parameter will always start with a '/', even if nothing
		follows the slash.
		*/
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
						res.writeHead(200, 'ok', {'content-type': 'application/json'});
						res.end(data[0]);
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

The rest of store.js defines the functions called in the server function.

---

## /js/view.js - the template renderer

### Setup

Workers are given the additional `local.worker` object to handle specific tasks. In TodoSOA, the worker is like other servers except for this setup:

```javascript
/*
Set a server for the worker.

ABOUT
Any request sent to the worker from the page will arrive here for fulfillment.

SharedWorkers can have multiple pages. Therefore, a third parameter (`page`) is passed with a PageConnection object
representing the origin of the request. If a worker is not shared, it can ignore the parameter.
*/
local.worker.setServer(function (req, res, page) {
```

---

Templates are rendered by path:

```javascript
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
```

---

## /js/host.js - the central control

### Constructor

The Host server creates agents that point to the storage and the different views:

```javascript
/**
 * Takes a model server and view server and acts as the Host between them
 *
 * @constructor
 * @param {string} storageUrl URL to the storage server
 * @param {string} viewUrl URL to the view server
 */
function Host(storageUrl, viewUrl) {
	// Call the local.Server constructor
	local.Server.call(this);

	// Generate agents which point toward the Storage server and View items
	var viewApi = local.agent(viewUrl);
	this.storageApi = local.agent(storageUrl);
	this.listItemView = viewApi.follow({ rel: 'item', id: 'listitem' });
	this.counterView  = viewApi.follow({ rel: 'item', id: 'counter' });
	this.clearBtnView = viewApi.follow({ rel: 'item', id: 'clearbtn' });
```

---

### Server Function

It renders the views with GET requests. In the case of the list-render, this can create multiple requests which require syncing:

```javascript
case 'SHOW':
	// Only applies to the following IDs:
	if (id != 'all' && id != 'active' && id != 'completed') {
		// Desired resource does not support SHOW
		return res.writeHead(405, 'bad method').end();
	}

	// Fetch the items from storage, filtered down to the set implied by our ID
	var query = {};
	if (id == 'active') { query.completed = 0; }
	else if (id == 'completed') { query.completed = 1; }
	this.storageApi.dispatch({ method: 'GET', query: query })
		.then(function(res2) {
			var items = res2.body;
			/*
			Send render GET requests for each item

			ABOUT
			Whenever multiple requests need to be coordinated, you can add them to
			an array and call one of the bundling functions. The resulting promise
			will be a fulfilled or rejected with an array containing all of the responses.
			- `local.promise.bundle()`: always fulfills the resulting promise, regardless
			   of whether each promise succeeds or fails.
			- `local.promise.all()`: only fulfills the resulting promise if all of the
			   contained promises succeed.
			- `local.promise.any()`: fulfills the resulting promise if any of the
			   contained promises succeed.
			*/
			var responses_ = [];
			items.forEach(function(item) {
				var query = { item_id: item.id, title: item.title, completed: item.completed };
				responses_.push(self.listItemView.dispatch({ method: 'GET', query: query }));
			});
			// Bundle the responses into one promise
			return local.promise.bundle(responses_);
		})
		.then(function(res3s) {
			// Render the HTML to the page
			self.$todoList.innerHTML = res3s.map(function(res3) { return res3.body; }).join('');
			res.writeHead(204, 'ok, no content').end();
		});
	break;
```

---

### Rendering

The SHOW request is used to re-render the list in reaction to various events.

```javascript
/**
 * Re-filters the todo items, based on the active route.
 * @param {boolean|undefined} force  forces a re-painting of todo items.
 */
Host.prototype._filter = function (force) {
	var activeRoute = this._activeRoute;

	// Update the elements on the page, which change with each completed todo
	this._updateCount();

	// If the last active route isn't "All", or we're switching routes, we
	// re-create the todo item elements, calling:
	//   this.show[All|Active|Completed]();
	if (force || this._lastActiveRoute !== 'all' || this._lastActiveRoute !== activeRoute) {
		// Send a SHOW request to ourself to render the intended set of items
		local.agent(this.getUrl())
			.follow({ rel: 'item', id: activeRoute })
			.dispatch({ method: 'SHOW' });
	}

	this._lastActiveRoute = activeRoute;
};
```

---

## Next Steps

If you want to see more of TodoSOA, <a href="//github.com/grimwire/todosoa">view the sourcecode</a> at GitHub.

Links from here:

 - <a href="#docs/example_mdviewer.md">Example: Markdown Viewer</a>
 - <a href="#docs/grimwire.md">Using Grimwire</a>