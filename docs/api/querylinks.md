queryLinks()
============

---

Helper used by `local.Agent` to search links. Uses query rules explained in the <a href="#docs/api/agent.md">Agent.follow()</a> documentation.

```javascript
local.queryLinks([{ href: 'httpl://foo', rel: 'service' }], { rel: 'service '});
// => { href: 'httpl://foo', rel: 'service' }
```

---

### Query Rules

Queries operate by the following rules:

 - MISS: if a query attribute is present on the link, but does not match
 - MISS: if a query attribute is not present on the link or in the link's href as a URI Template token
 - otherwise, MATCH

The first match will be followed, and order is maintained from the response header. Additionally, the following rules are observed on the query values:

 - Query values preceded by an exclamation-point (!) will invert (logical NOT)
 - `rel`: can take multiple values, space-separated, which are ANDed logically
 - `rel`: will ignore the preceding scheme and trailing slash on URI values
 - `rel`: items preceded by an exclamation-point (!) will invert (logical NOT)

Some examples:

```javascript
console.log(links);
/* => [
	{ href: 'httpl://foo', rel: 'up service' }
	{ href: 'httpl://foo/messages{?isnew}', rel: 'self collection foobar.com/messages' }
	{ href: 'httpl://foo/messages/{id}' rel: 'item foobar.com/message' }
] */
local.queryLinks(link, { rel: 'up' }); // => [{ href: 'httpl://foo', ...}]
local.queryLinks(link, { rel: 'item foobar.com/message', id: 500 }); // => [{ href: 'httpl://foo/messages/{id}', ...}]
local.queryLinks(link, { rel: 'self', isnew: 1 }); // => [{ href: 'httpl://foo/messages{?isnew}', ...}]

local.queryLinks(link, { rel: '!up' }); // => [{ href: 'httpl://foo/messages{?isnew}', ...}, { href: 'httpl://foo/messages/{id}' ...}]
local.queryLinks(link, { rel: 'item', id: 500 }); // => [{ href: 'httpl://foo/messages/{id}', ...}]
local.queryLinks(link, { rel: 'foobar.com/message', id: 500 }); // => [{ href: 'httpl://foo/messages/{id}', ...}]
local.queryLinks(link, { rel: 'item foobar.com/user' }); // => []
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

### local.queryLinks(links, query)

 - `links`: required Array(object)|local.Response, the (parsed) array of links or a response with a link header
 - `query`: required object, the query to run against the links
 - returns Array(object), the list of matching links

---

### local.queryLink(link, query)

 - `link`: required objec, the (parsed) link
 - `query`: required object, the query to run against the links
 - returns bool, does the query match the link

Used by `local.queryLinks()`