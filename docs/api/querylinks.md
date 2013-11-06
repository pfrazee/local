queryLinks()
============

---

Helper used by `local.Agent` to search links. Uses query rules explained in the <a href="#docs/api/agent.md">Agent.follow()</a> documentation.

```javascript
local.queryLinks([{ href: 'httpl://foo', rel: 'service' }], { rel: 'service '});
// => { href: 'httpl://foo', rel: 'service' }
```

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