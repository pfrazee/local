Local 0.6.0
===========

[<a href="https://github.com/grimwire/local">Repository</a> | <a href="https://github.com/grimwire/local/issues">Issues</a> | <a href="http://grimwire.com/local">Documentation</a>]

## Overview

Local.js is an Ajax library that implements <a href="https://github.com/grimwire/grimwire/wiki/HTTPL%3A-JSON-encoded-message-streams-with-HTTP-semantics" title="HTTP Local">HTTPLocal, a client-side variation of HTTP</a>. It can be used to communicate with Web Workers, WebRTC peers, and other messaging channels.

Local.js also includes a directory protocol to exchange links, discover services, and navigate with user-agents.

### Examples

Run servers in the document:

```javascript
local.addServer('foobar', function(req, res) {
    // Handles incoming requests from the application
    res.writeHead(200, 'ok', { 'Content-Type': 'text/plain' });
    res.end('Hello, application!');
});
local.dispatch({ method: 'GET', url: 'httpl://foobar' }).then(handle2or3xx, handle4or5xx);
```

Run servers in Web Workers:

```javascript
local.spawnWorkerServer('http://myhost.com/myworker.js', function(req, res) {
    // Handles incoming requests from the worker
    res.writeHead(200, 'ok', { 'Content-Type': 'text/plain' });
    res.end('Hello, worker!');
});
local.dispatch({ method: 'GET', url: 'httpl://myworker.js' });
```

Run servers over WebRTC:

```javascript
var network = local.joinRelay('https://grimwire.net', function (req, res, peer) {
    // Handles incoming requests from `peer`
    res.writeHead(200, 'ok', { 'Content-Type': 'text/plain' });
    res.end('Hello, '+peer.getPeerInfo().user);
});
local.dispatch({ method: 'GET', url: 'httpl://bob@grimwire.net!bobs-app.com' });
```

<br/>

## How it works

The core of Local.js is a message router which adds a new scheme, `httpl://`, for targeting requests at functions within the application. These in-app server functions work similarly to node.js servers, and support streaming for requests and responses. Special types of server functions, the "bridge" servers, serialize the streams into JSON and transport them over channels to other namespaces.

<img src="assets/docs-messaging-diagram.png" />

## User Agents

The `local.Agent` is a headless browser that travels Web APIs. It issues HEAD requests to hosts, then runs queries against the returned Link headers to navigate. The navigation queries allow applications to reason about remote hosts and make strong assumptions based on reltypes. This protocol is outlined in the [Web Linking spec](http://tools.ietf.org/html/rfc5988).

> Read more in the <a href="#docs/api/agent.md">agent()</a> documentation.

```javascript
// Fetch the profile of bob@foo.com
local.agent('http://foo.com')
    .follow({ rel: 'gwr.io/users' }) // documented at http://gwr.io/users
    .follow({ rel: 'item', id: 'bob' })
    .GET({ Accept: 'application/json' })
```

<br/>

## Getting Started

Download <a href="//github.com/grimwire/local">local.js or local.min.js from the repository</a>. If you're developing for Grimwire, download <a href="//github.com/grimwire/grimwire">grimwidget.js from the Grimwire repo</a> and read the documentation on <a href="#docs/grimwire.md">Using Grimwire</a>.

For an introduction to writing Local.js apps, read <a href="#docs/todosoa.md">Intro: TodoSOA</a>.

### Getting Help

Contact <a href="//twitter.com/pfrazee">@pfrazee</a> or join #grimwire on freenode.

### Feedback &amp; Bug Reporting

Send specific issues and suggestions to the [GitHub issue tracker](https://github.com/grimwire/local/issues). Suggestions to improve the documentation can be added to the ongoing [Documentation Improvements](https://github.com/grimwire/local/issues/77) issue.

<br/>

## Misc

### Special thanks and credits

Thank you to the following third-party library authors:

 - [**parseUri**](http://stevenlevithan.com/demo/parseuri/js/), Stephen Levithan
 - [**UriTemplate**](https://github.com/fxa/uritemplate-js), Franz Antesberger
 - [**Prism**](https://github.com/LeaVerou/prism), Lea Verou
 - [**Marked**](https://github.com/chjj/marked), Christopher Jeffrey

Special thanks to [Goodybag.com](http://goodybag.com) for their support during the development of this project. If you're in Austin and need food delivered to the office, be sure to check out their website.

### License

The MIT License (MIT)
Copyright (c) 2014 Paul Frazee

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
