agent()
=======

---

A headless browser which navigates Web APIs by following links in response headers.

```javascript
local.agent('httpl://myhost')
    .follow({ rel: 'collection', id: 'users' })
    .follow({ rel: 'item', id: 'bob' })
    .get({ Accept: 'application/json' });
```

Navigations are made by issuing HEAD requests and querying the returned Link headers for the next destination. Each `follow()` produces a new `local.Agent` which stores its query and a reference to its parent. When asked to resolve (either due to a request or a `resolve()` call) the agent will resolve its parent, then search the parent's received links. The resolved URL is then cached for future requests.

<img src="assets/docs-agent-diagram.jpg" />

If a `follow()` fails to find a matching link, any resolving children will also fail, resulting in a `{status: 1}` "Link Not Found" response.

Agents will detect <a href="http://tools.ietf.org/html/rfc6570" title="RFC 6570 - URI Template">URI Template</a> tokens in the URI and treat them as a matching attribute in link queries. To resolve, the tokens are replaced by the values in the query. This is illustrated above with the "id" attribute.

---

### local.agent(<span class="muted">location</span>)

 - `location`: optional URL|Array|local.Agent, the location for the agent to point to.
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

The protocol for agent navigations is defined in <a href="http://tools.ietf.org/html/rfc5988">RFC 5988 - Web Linking</a>. The standard defines a Link header with identical semantics to the `<link>` HTML element.

```markup
<link rel="stylesheet" href="mypage.css" /> <!-- will provide styling content -->
```

The Link header standardizes a link format outside of the response body, solving a common interoperability issue. "Relation types" stored in the `rel` attribute can be used to label protocols in the Web API, guaranteeing specific behaviors to clients. Links may use one or more reltype from the <a href="http://www.iana.org/assignments/link-relations/link-relations.xhtml#link-relations-1">IANA public registry</a>. If a custom reltype is needed, it should be a valid HTTP/S URL which hosts documentation on the reltype's protocol. This helps other developers implement the APIs.

```markup
Link: <httpl://myhost/users>; rel="collection foobar.com/users foobar.com/paginated"; id="users"
```

---

### Proxy Links

Proxies are commonly used in Local.js - for instance, when a worker wants to reach a server on the page that's not its dedicated server. Because proxied URLs include two full URIs (the proxy's and the upstream target's) it's necessary to percent-encode the upstream. However, percent-encoding keeps the agent from recognizing URI templates in the links.

To solve this, proxies can set the 'Proxy-Tmpl' response header with a template to construct the final URI. Any URIs in the Link header should then only include the upstream. If multiple proxies are in use, then each should include a template (space-separated) with the first proxy showing first in the header.

```javascript
res.setHeader('Uri-Template', 'httpl://myproxy/{uri}');
res.setHeader('Link', [
	{ href: '/', rel: 'self service via', title: 'Host Page', noproxy: true },
	// ^ the noproxy link attribute will exclude Proxy-Tmpl from being applied on that link
	{ href: 'httpl://upstream.server', rel: 'service', title: 'Some Upstream Service' }
	// ^ this link will resolve to "httpl://myproxy/httpl%3A%2F%2Fupstream.server"
]);
```

The proxy templates should only include the `{uri}` token.

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

Local.js does additional parsing on link headers to add the following queryable attributes:

 - `host_domain`: the domain of the href, equivalent to `local.parseUri(link.href).authority`
 - `host_user`: if a peer URI, the user id part of the URI
 - `host_relay`: if a peer URI, the relay domain part of the URI
 - `host_app`: if a peer URI, the app domain part of the URI
 - `host_sid`: if a peer URI, the stream id part of the URI

Additionally, links hosted on Grimwire relays include the following queryable attribite:

 - `relay_user`: the id of the user who registered the link

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

---

### .links

An array of parsed links from the most recent successful request by the agent.

---

## Dispatch sugars

In all of the following functions, the `body` parameter is mixed into `options`.

```javascript
myagent.POST({ foo: 'bar' }, { Accept: 'text/html', stream: true });
// equivalent to:
myagent.dispatch({
	method: 'POST',
	headers: { accept: 'text/html', 'content-type': 'application/json' },
	body: { foo: 'bar' },
	stream: true
});
```

### .HEAD(<span class="muted">options</span>)

### .GET(<span class="muted">options</span>)

### .DELETE(<span class="muted">options</span>)

### .POST(<span class="muted">body</span>, <span class="muted">options</span>)

### .PUT(<span class="muted">body</span>, <span class="muted">options</span>)

### .PATCH(<span class="muted">body</span>, <span class="muted">options</span>)

### .NOTIFY(<span class="muted">body</span>, <span class="muted">options</span>)

### .SUBSCRIBE(<span class="muted">body</span>, <span class="muted">options</span>)