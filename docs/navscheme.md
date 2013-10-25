nav:|| URIs
===========

---

Agent navigations can be serialized into 'nav:' URIs, allowing you to embed them in GUIs and navigate links without creating an agent. The following two examples are equivalent:

```javascript
local.agent('httpl://myhost')
    .follow({ rel: 'collection', id: 'users' })
    .follow({ rel: 'item', id: 'bob' })
    .get({ accept: 'application/json' });

// has the same result as:
local.dispatch({
	method: 'GET',
	url: 'nav:||httpl://myhost|collection=users|item=bob',
	headers: { accept: 'application/json' }
});
```

## Scheme Format

Nav URIs are a serialization of `local.Agent` navigations. They are constructed as follows:

<strong>nav:||<span style="color: rgb(216, 56, 56)">httpl://host</span>|<span style="color: rgb(81, 129, 201)">reltype</span><span style="color: rgb(81, 160, 37)">=id</span><span style="color: rgb(216, 149, 31)">,attr1=value1,attr2=value2</span>|reltype=id,attr1=value1,attr2=value2,...</strong>

 1. <strong style="color: rgb(216, 56, 56)">Starting URL</strong>: required, an absolute location
 2. <strong style="color: rgb(81, 129, 201)">Reltype</strong>: required, sets the `rel` attribute of the navigation query
 3. <strong style="color: rgb(81, 160, 37)">ID</strong>: optional, sets the `id` attribute of the query
 4. <strong style="color: rgb(216, 149, 31)">Attributes</strong>: optional, any number of additional query attributes

Spaces are encoded with `+`, which can be used to specify multiple reltypes.

Examples:

```
nav:||httpl://myhost|collection=users
nav:||httpl://myhost|foobar.com/users,online=1
nav:||httpl://myhost|collection+foobar.com/users|item=bob
```

## Relative Nav URIs

Agents can use relative nav URIs in its `follow()` calls.

```javascript
local.agent('httpl://myhost')
	.follow('|collection=users|item=bob')
	.get({ accept: 'application/json' });
```