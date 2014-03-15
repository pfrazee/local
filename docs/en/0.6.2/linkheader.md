Hypermedia Indexing Protocol
============================

---

Local.js uses the [Web Linking](http://tools.ietf.org/html/rfc5988) standard to export metadata about services in the form of links.

```javascript
local.dispatch({ method: 'HEAD', url: 'http://foobar.com' })
```
```text
> HEAD http://foobar.com HTTP/1.1
< HTTP/1.1 204 no content
< Link: <http://foobar.com>; rel="self service",
<       <http://foobar.com/mail>; rel="collection"; id="mailboxes",
<       <http://foobar.com/users>; rel="collection"; id="users"
```
```javascript
  .then(function(res) {
    local.queryLinks(res, { rel: 'collection' });
    // => [
    //      { href: "http://foobar.com/mail", rel: "collection", id: "mailboxes" },
    //      { href: "http://foobar.com/users", rel: "collection", id: "users" }
    //    ]
  });
```

---

### URI Templates

Servers can use [URI Templates](http://tools.ietf.org/html/rfc6570) in their exported links (with [fxa/uritemplate-js](https://github.com/fxa/uritemplate-js)).

```javascript
local.dispatch({ method: 'HEAD', url: 'http://foobar.com/users' })
```
```text
> HEAD http://foobar.com/users HTTP/1.1
< HTTP/1.1 204 no content
< Link: <http://foobar.com>; rel="up service via",
<       <http://foobar.com/users{?fname,lname}>; rel="self collection"; id="users",
<       <http://foobar.com/users/admin>; rel="item"; id="admin",
<       <http://foobar.com/users/{id}>; rel="item"
```
```javascript
  .then(function(res) {
    var selfLink = local.web.queryLinks(res, { rel: 'self collection' })[0];
    local.UriTemplate.parse(selfLink.href).expand({ fname: 'Bob', lname: 'Robertson' });
    // => http://foobar.com/users?fname=Bob&lname=Robertson

    var itemLinks = local.web.queryLinks(res, { rel: 'item' });
    local.UriTemplate.parse(itemLinks[1].href).expand({ id: 'brobertson' });
    // => http://foobar.com/users/brobertson
  });
```

---

### Index Navigation

The [Agent](#docs/en/0.6.2/api/agent.md) follows queries by issuing HEAD requests, searching the links, and issuing subsequent HEAD requests based on matches. The navigations are followed "lazily," meaning that the HEAD requests are only sent when the application calls a dispatch function.

> Read about link headers in [[The Hypermedia Indexing Protocol]]

```javascript
local.agent('http://foobar.com')
  .follow({ rel: 'collection', id: 'users' })
  .follow({ rel: 'item', id: 'brobertson' })
  .dispatch({ method: 'GET', headers: { accept: 'application/json' }})
```
```text
> HEAD http://foobar.com
< HTTP/1.1 204 no content
< Link: <http://foobar.com>; rel="self service",
<       <http://foobar.com/mail>; rel="collection"; id="mailboxes",
<       <http://foobar.com/users>; rel="collection"; id="users"

> HEAD http://foobar.com/users HTTP/1.1
< HTTP/1.1 204 no content
< Link: <http://foobar.com>; rel="up service via foobar.com/-service",
<       <http://foobar.com/users/admin>; rel="item"; id="admin",
<       <http://foobar.com/users/{id}>; rel="item"

> GET http://foobar.com/users/brobertson HTTP/1.1
< HTTP/1.1 200 ok
> Accept: application/json
< ...
```

Notice that the item navigation did not find a full match. The navigator first looks for an exact match, then for a match with all attributes either matching or present in the URI template. In this case, `{ rel: 'item', id: 'brobertson' }` matched with `<http://foobar.com/users/{id}>; rel="item"`.