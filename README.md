Local.js 0.6.2
==============

[<a href="https://github.com/pfraze/local">Repository</a> | <a href="https://github.com/pfraze/local/issues">Issues</a> | <a href="http://httplocal.com/docs.html">Documentation</a>]

## Overview

Local.js is an open-source security and IPC framework for socially-shareable Web plugins. It provides an Ajax interface for communicating interchangeably with javascript functions, parallel threads, and network peers. It also includes tools for managing and securing Web Workers, for emitting and subscribing to Server-Sent Events, and for exchanging and querying against links.

### Examples

**Run servers in the document**:

```javascript
local.addServer('foobar', function(req, res) {
    // Handles incoming requests from the application
    res.writeHead(200, 'ok', { 'Content-Type': 'text/plain' });
    res.end('Hello, application!');
});
local.dispatch({ method: 'GET', url: 'httpl://foobar' }).then(handle2or3xx, handle4or5xx);
```

**Run servers in Web Workers**:

```javascript
local.spawnWorkerServer('http://myhost.com/myworker.js', function(req, res) {
    // Handles incoming requests from the worker
    res.writeHead(200, 'ok', { 'Content-Type': 'text/plain' });
    res.end('Hello, worker!');
});
local.dispatch({ method: 'GET', url: 'httpl://myworker.js' }).then(...);
```

**Auto-spawn a temporary Worker** to handle a request. After responding, the temp-worker is destroyed:

```javascript
local.dispatch({ method: 'GET', url: 'httpl://myhost.com(/myworker.js)/' }).then(...);
```

Using **bodyless request sugars**:

```javascript
local.HEAD('httpl://myhost.com(/myworker.js)/');
local.GET('httpl://myhost.com(/myworker.js)/');
local.GET({ url: 'httpl://myhost.com(/myworker.js)/', Accept: 'application/json' });
local.DELETE('httpl://myhost.com(/myworker.js)/');

// For reference, the non-sugar equivalent:
local.dispatch({ method: 'GET', url: 'httpl://myhost.com(/myworker.js)/', Accept: 'application/json' });
```

Using **bodyfull request sugars**:

```javascript
local.POST({ foo: 'bar' }, 'httpl://myhost.com(/myworker.js)/');
local.PUT({ foo: 'bar' }, 'httpl://myhost.com(/myworker.js)/');
local.PATCH({ foo: 'bar' }, 'httpl://myhost.com(/myworker.js)/');
local.POST({ foo: 'bar' }, {
    url: 'httpl://myhost.com(/myworker.js)/',
    Accept: 'application/json',
    Content_Type: 'application/www-x-form-urlencoded'
});

// For reference, the non-sugar equivalent:
local.dispatch({
    method: 'POST',
    url: 'httpl://myhost.com(/myworker.js)/',
    Accept: 'application/json',
    Content_Type: 'application/www-x-form-urlencoded',
    body: { foo: 'bar' }
});
```

Note that headers may have their dashes changed to underscores. However, if in the request object, headers must be capitalized. To avoid this requirement, put them in the **`headers` sub-object**:

```javascript
local.dispatch({
    method: 'POST',
    url: 'httpl://myhost.com(/myworker.js)/',
    headers: {
        accept: 'application/json',
        'content-type': 'application/www-x-form-urlencoded'
    },
    body: { foo: 'bar' }
});
```

If you need to **stream the request**, create a [`local.Request`](http://httplocal.com/docs.html#docs/en/0.6.2/api/request.md) object, then send it to [`local.dispatch()`](http://httplocal.com/docs.html#docs/en/0.6.2/api/dispatch.md):

```javascript
var req = new local.Request({ method: 'POST', url: 'http://foo.com', Content_Type: 'text/plain' });
local.dispatch(req).then(...);
for (var i = 0; i < 10; i++) {
    req.send(''+i+'\n');
}
req.end();
```

A dispatch call returns a promise which resolves to the response when the response-stream finishes. If the status is in the 200-300 range, it is fulfilled; otherwise, the promise is rejected with the response as the error-value.

If you need to **stream the response**, use the `stream: true` attribute in the request. The promise will be fulfilled when the headers are sent, and you can then attach to the 'data' and 'end' events:

```javascript
local.GET({ url: 'http://foo.com', stream: true })
    .then(function(res) {
        console.log(res.status); // => 200
        res.on('data', function(chunk) {
            // ...
        });
        res.on('end', function() {
            // ...
        });
    });
}
```

Local.js includes a registry of content-type serializers and parsers which are auto-invoked on the 'end' events of requests and responses. By default, it ships with json and application/x-www-form-urlencoded, but you can register more with [`local.contentTypes`](http://httplocal.com/docs.html#docs/en/0.6.2/api/contenttypes.md).

If successful, the **`body` attribute will include the parsed object**. If parsing fails, or the content-type is not available, the `body` attribute will be a string. Note that server functions are fired when headers are received, and so must always wait for the 'end' event:

```javascript
local.addServer('foobar', function(req, res) {
    console.log(req.header('Content-Type')); // => 'application/json'
    req.on('end', function() {
        res.writeHead(200, 'ok', { 'Content-Type': 'application/x-www-form-urlencoded' });
        res.end('foo='+req.body.foo);
    });
});
local.POST({ foo: 'bar' }, 'httpl://foobar') // will default content-type to json
    .then(function(res) {
        console.log(res.header('Content-Type')); // => 'application/x-www-form-urlencoded'
        console.log(res.body); // => { foo: 'bar' }
    });
```

Local.js also includes a registry of header serializers and parsers which are auto-invoked on dispatch - [`local.httpHeaders`](http://httplocal.com/docs.html#docs/en/0.6.2/api/httpheaders.md). By default, it ships with Link, Accept, and Via. In responses, the **parsed headers are placed in the `response.parsedHeaders` object** to avoid confusion:

```javascript
local.HEAD('http://foo.com').then(function(res) {
    console.log(res.headers.link); // => '<http://foo.com>; rel="self service"; title="Foo!"'
    console.log(res.header('Link')); // => '<http://foo.com>; rel="self service"; title="Foo!"'
    console.log(res.parsedHeaders.link); // => [{ href: 'http://foo.com', rel: 'self service', title: 'Foo!' }]
});
```

**To query the links**, use [`local.queryLinks`](http://httplocal.com/docs.html#docs/en/0.6.2/api/querylinks.md):

```javascript
local.HEAD('http://foo.com').then(function(res) {
    var links = local.queryLinks(res.headers.link, { rel: 'self' });
    console.log(links); // => [{ href: 'http://foo.com', rel: 'service', title: 'Foo!' }]
    var links = local.queryLinks(res, { rel: 'self' })
    console.log(links); // => [{ href: 'http://foo.com', rel: 'service', title: 'Foo!' }]
});
```

**To decide which content-type to respond with**, use [`local.preferredType`](http://httplocal.com/docs.html#docs/en/0.6.2/api/preferredtypes.md):

```javascript
local.addServer('foobar', function(req, res) {
    var type = local.preferredType(req, ['text/html', 'text/plain', 'application/json']);
    if (!type) { return res.writeHead(406, 'Not Acceptable').end(); }
    if (type == 'text/html') { /* ... */ }
    // ...
});
local.GET({ url: 'httpl://foobar', Accept: 'text/plain' }); // will get text/plain
local.GET({ url: 'httpl://foobar', Accept: 'application/json, text/*' }); // will get application/json
local.GET({ url: 'httpl://foobar', Accept: '*/*' }); // will get text/html
```

**Programmatically navigate with a headless user-agent**:

```javascript
// Fetch the profile of bob@foo.com
local.agent('http://foo.com')
    .follow({ rel: 'gwr.io/users' }) // documented at http://gwr.io/users
    .follow({ rel: 'item', id: 'bob' })
    .GET({ Accept: 'application/json' })
```

Further topics:

 - [Subscribing to server-sent events](http://httplocal.com/docs.html#docs/en/0.6.2/api/subscribe.md)
 - [Parsing and creating URLs](http://httplocal.com/docs.html#docs/en/0.6.2/api/uri_helpers.md)
 - [Piping a response](http://httplocal.com/docs.html#docs/en/0.6.2/api/pipe.md)
 - [Patching XMLHttpRequest to support httpl](http://httplocal.com/docs.html#docs/en/0.6.2/api/patchxhr.md)
 - [Registering a catchall DOM-event listener to generate request events on link-clicks and form-submits](http://httplocal.com/docs.html#docs/en/0.6.2/api/bindreqeuestevents.md)
 - [Auditing every request before it is dispatched from the page](http://httplocal.com/docs.html#docs/en/0.6.2/api/setdispatchwrapper.md)
 - [Syncing and manipulating promises](http://httplocal.com/docs.html#docs/en/0.6.2/api/promises.md)

<br/>

## How it works

The core of Local.js is a message router which adds a new scheme, `httpl://`, for targeting requests at functions within the application. These in-app server functions work similarly to node.js servers, and support streaming for requests and responses. Special types of server functions, the "bridge" servers, serialize the streams into JSON and transport them over channels to other namespaces.

<img src="assets/docs-messaging-diagram.png" />

Further reading:

 - [HTTPL: JSON encoded message streams with HTTP semantics](http://httplocal.com/docs.html#docs/en/0.6.2/httpl.md)
 - [Hypermedia Indexing Protocol (Link Header Usage)](http://httplocal.com/docs.html#docs/en/0.6.2/linkheader.md)
 - [In-Application Sandboxing with Web Workers](http://pfraze.github.io/2014/03/08/in-application-sandboxing-with-web-workers.html)
 - [Communicating with Web-Workers using HTTP](http://pfraze.github.io/2014/03/08/communicating-with-web-workers-using-http.html)
 - [Applying User-Agent Behaviors in Web Applications to Enable Runtime Extension](http://pfraze.github.io/2014/03/08/applying-user-agent-behaviors.html)

<br/>

## Getting Started

Download <a href="//github.com/pfraze/local">local.js or local.min.js from the repository</a>. Then read the documentation at <a href="http://httplocal.com">HTTPLocal.com</a>. For an introduction to writing Local.js apps, read <a href="http://httplocal.com/docs.html#docs/en/0.6.2/todosoa.md">Intro: TodoSOA</a>.

### Getting Help

Contact <a href="//twitter.com/pfrazee">@pfrazee</a> or join #httpl on freenode.

### Feedback &amp; Bug Reporting

Send specific issues and suggestions to the [GitHub issue tracker](https://github.com/pfraze/local/issues). Suggestions to improve the documentation can be added to the ongoing [Documentation Improvements](https://github.com/pfraze/local/issues/77) issue.

<br/>

## Misc

### Special thanks and credits

Thank you to the following third-party library authors:

 - [**parseUri**](http://stevenlevithan.com/demo/parseuri/js/), Stephen Levithan
 - [**UriTemplate**](https://github.com/fxa/uritemplate-js), Franz Antesberger
 - [**Negotiator**](https://github.com/federomero/negotiator), Federico Romero, Isaac Z. Schlueter
 - [**Prism**](https://github.com/LeaVerou/prism), Lea Verou
 - [**Marked**](https://github.com/chjj/marked), Christopher Jeffrey

Special thanks to [Goodybag.com](http://goodybag.com) for their support during the development of this project. If you're in Austin and need food delivered to the office, be sure to check out their website.

### License

The MIT License (MIT)
Copyright (c) 2014 Paul Frazee

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
