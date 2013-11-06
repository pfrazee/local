agent()
=======

---

A programmatic browser which follows links provided in response headers. Every navigation is lazy, waiting for a dispatch call before resolving the queries to URLs.

```javascript
local.agent('httpl://myhost')
    .follow({ rel: 'collection', id: 'users' })
    .follow({ rel: 'item', id: 'bob' })
    .get({ accept: 'application/json' });
```

Links are resolved by issuing HEAD requests, then searching the returned Link headers. Each navigation produces a new, unresolved `local.Agent` with a reference to its parent. To find its URL, the agent will resolve the parent, then search the resulting links.

If a query fails, any resolving children will also fail, resulting in a `{status: 1}` "Link Not Found" response.

---

### local.agent(<span class="muted">query</span>)

 - `query`: optional URL|Array|local.Agent, the location for the agent to point to.
 - returns `local.Agent`

Standard usage is to pass an absolute URL, setting the starting point for future navigations.

```javascript
var myhost = local.agent('httpl://myhost');
var users  = myhost.follow({ rel: 'collection', id: 'users' });
var bob    = users.follow({ rel: 'item', id: 'bob' });
```

Alternatively, a series of navigations can be given in an array:

```javascript
var bob = local.agent([
	'httpl://myhost',
	{ rel: 'collection', id: 'users' },
	{ rel: 'item', id: 'bob' }
]);
```

---

### Web Linking and Reltypes

The protocol for agent navigations is defined in <a href="http://tools.ietf.org/html/rfc5988">RFC 5988 - Web Linking</a>. This is a relatively new standard with some adoption (eg, <a href="http://developer.github.com/v3/issues/">at GitHub</a>) and a history with the `<link>` element. The behavior is basically the same.

```
HTTP/1.1 200 OK
Link: <httpl://myhost>; rel="service"; title="My Host", <httpl://myhost/users>; rel="collection"; id="users"
```

The Link header standardizes a link format outside of the response body, solving a common interoperability issue. Additionally, "relation types" can be used to label protocols in the Web API, guaranteeing specific behaviors to clients. This is commonly practiced with favicons and stylesheets:

```markup
<link rel="stylesheet" href="mypage.css" /> <!-- will provide styling content -->
```

Links may use one or more reltype from the <a href="http://www.iana.org/assignments/link-relations/link-relations.xhtml#link-relations-1">IANA public registry</a>. If a custom reltype is needed, it should be a valid HTTP/S URL which hosts documentation on the reltype's protocol. This helps other developers implement the APIs.

```
Link: <httpl://myhost/users>; rel="collection foobar.com/users foobar.com/paginated"; id="users"
```

Multiple reltypes can be combined to provide different guarantees.

---

## local.Agent

### .follow(query)

 - `query`: required object|string, a query object or relative nav: URI
 - returns `local.Agent`

Creates a new `local.Agent` which will search the parent's links for an item matching `query`. Queries operate by the following rules:

 - MISS: if a query attribute is present on the link, but does not match
 - MISS: if a query attribute is not present on the link or in the link's href as a URI Template token
 - otherwise, MATCH

The first match will be followed, and order is maintained from the response header. Additionally, the following rules are observed on the query values:

 - Query values preceded by an exclamation-point (!) will invert (logical NOT)
 - `rel`: can take multiple values, space-separated, which are ANDed logically
 - `rel`: will ignore the preceding scheme and trailing slash on URI values
 - `rel`: items preceded by an exclamation-point (!) will invert (logical NOT)
 - URI Template tokens in the `href` will be replaced by matching query values.

Some examples:

```javascript
console.log(myagent.context.links);
/* => [
	{ href: 'httpl://foo', rel: 'up service' }
	{ href: 'httpl://foo/messages{?isnew}', rel: 'self collection foobar.com/messages' }
	{ href: 'httpl://foo/messages/{id}' rel: 'item foobar.com/message' }
] */
myagent.follow({ rel: 'up' }); // => httpl://foo
myagent.follow({ rel: 'item foobar.com/message', id: 500 }); // => httpl://foo/messages/500
myagent.follow({ rel: 'self', isnew: 1 }); // => httpl://foo/messages?isnew=1

myagent.follow({ rel: '!up' }); // => httpl://foo/messages
myagent.follow({ rel: 'item', id: 500 }); // => httpl://foo/messages/500
myagent.follow({ rel: 'foobar.com/message', id: 500 }); // => httpl://foo/messages/500
myagent.follow({ rel: 'item foobar.com/user' }); // => link not found
```

---

### .dispatch(<span class="muted">request</span>)

 - `request`: optional object
 - returns `local.Promise(response)`

Dispatches the given request to the current URL, resolving the agent first if required.

---

### .resolve(<span class="muted">options</span>)

 - `options.noretry`: optional boolean, should we fail without retry if it previously failed?
 - `options.nohead`: optional boolean, should we skip sending HEAD request once we find a matching link?
 - returns `local.Promise(url)`

Resolves the agent's URL, reporting failure if a link or resource is unfound.

---

### .unresolve(<span class="muted">options</span>)

 - returns `this`

Resets the agent's state to 'unresolved', causing future requests to run the resolve process again.

---

### .rebase(url)

 - `url`: required string, the URL to rebase the agent to
 - returns `this`

Unresolves the agent and changes the agent's URL.

```javascript
// Change the root agent and unresolve children to use a new host
myhost.rebase('httpl://another-host');
users.unresolve();
bob.unresolve();
```

---

### .subscribe(<span class="muted">request</span>)

 - `request`: optional object
 - returns `local.Promise(local.EventStream)`

Calls `local.subscribe()` on the agent's resolved URL, then fulfills the given promise with the resulting stream.

## Dispatch sugars

In all of the following functions, the `headers` and `body` parameters are mixed into the (optional) `request` object.

```javascript
myagent.post({ foo: 'bar' }, { accept: 'text/html' }, { stream: true });
// equivalent to:
myagent.dispatch({
	method: 'POST',
	headers: { accept: 'text/html' },
	body: { foo: 'bar' },
	stream: true
});
```

### .head(<span class="muted">headers</span>, <span class="muted">request</span>)

### .get(<span class="muted">headers</span>, <span class="muted">request</span>)

### .delete(<span class="muted">headers</span>, <span class="muted">request</span>)

### .post(<span class="muted">body</span>, <span class="muted">headers</span>, <span class="muted">request</span>)

### .put(<span class="muted">body</span>, <span class="muted">headers</span>, <span class="muted">request</span>)

### .patch(<span class="muted">body</span>, <span class="muted">headers</span>, <span class="muted">request</span>)

### .notify(<span class="muted">body</span>, <span class="muted">headers</span>, <span class="muted">request</span>)