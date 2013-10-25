URI Helpers
===========

### local.parseUri(uri)

 - `uri`: required string|local.Request
 - returns object

Written by Stephen Levithan. It breaks the input URL into its component parts:

```javascript
local.parseUri('http://usr:pwd@www.test.com:81/dir/dir.2/index.htm?q1=0&&test1&test2=value#top')
{
  anchor: "top"
  authority: "usr:pwd@www.test.com:81"
  directory: "/dir/dir.2/"
  file: "index.htm"
  host: "www.test.com"
  password: "pwd"
  path: "/dir/dir.2/index.htm"
  port: "81"
  protocol: "http"
  query: "q1=0&&test1&test2=value"
  queryKey: {
    q1: "0"
    test1: ""
    test2: "value"
  }
  relative: "/dir/dir.2/index.htm?q1=0&&test1&test2=value#top"
  source: "http://usr:pwd@www.test.com:81/dir/dir.2/index.htm?q1=0&&test1&test2=value#top"
  user: "usr"
  userInfo: "usr:pwd"
}
```

<a target="_blank" href="http://stevenlevithan.com/demo/parseuri/js/">Read the full reference at Steven Levithan's site.</a>

---

### local.parseNavUri(uri)

 - `uri`: required string, a 'nav:' URI
 - returns Array(object)

Converts a 'nav:' URI into an array of http/s/l URIs and link query objects.

---

### local.parsePeerDomain(domain)

 - `domain`: required string, the peer domain
 - returns object

Breaks a peer domain (assigned by a Grimwire relay) into its constituent parts. Returns null if not a valid peer uri.

```javascript
local.parsePeerDomain('bob@grimwire.net!chat.grimwire.com:123')
{
	domain: 'bob@grimwire.net!chat.grimwire.com:123',
	user: 'bob',
	relay: 'grimwire.net',
	app: 'chat.grimwire.com',
	stream: '123'
}
```

---

### local.makePeerDomain(user, relay, app, stream)

 - `user`: required string
 - `relay`: required string
 - `app`: required string
 - `stream`: required number
 - returns string

Constructs a peer domain from its constituent parts.

```javascript
local.makePeerDomain('bob', 'grimwire.net', 'chat.grimwire.com', 123)
// => bob@grimwire.net!chat.grimwire.com:123
```

---

### local.joinUri(uris...)

 - `uris`: a list of URI fragments

Correctly joins together all url segments given in the arguments.

```javascript
local.joinUrl('/foo/', '/bar', '/baz/')
// => /foo/bar/baz/
```

---

### local.isAbsUri(uri)

 - `uri`: required string
 - returns bool

Is the URL is absolute (in the HTTP/S/L schemes)?

---

### local.isNavSchemeUri(uri)

 - `uri`: required string
 - returns bool

Is the URL is using the nav scheme?

---

### local.joinRelPath(url, relpath)

 - `url`: required string
 - `relpath`: required string
 - returns string

Takes a base (absolute) URL and a relative path and forms a new valid URL.

```javascript
local.joinRelPath('http://grimwire.com/foo/bar', '../fuz/bar')
// => http://grimwire.com/foo/fuz/bar
```