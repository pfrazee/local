Local 0.4.0dev
==============

pfraze 2013


## Overview

Local.js is an Ajax library which can target JS Functions, Web Workers, WebRTC Peers, Data URIs, and public Web servers using HTTP-style requests. Applications can use it to structure their components in an SOA, abstracting over the messagable environments with a common protocol. It can be used with [Grimwire](https://github.com/grimwire/grimwire), a node.js "Peer Relay", to create WebRTC sessions. Additionally, Local.js makes use of the [Web Linking spec](http://tools.ietf.org/html/rfc5988) to programmatically navigate APIs, allowing you to reason about a component's capabilities and automatically configure to them.

### Features

 - Promises-based Ajax library with support for streams
 - SSE-based EventStream APIs for distributed event-subscriptions
 - A programmatic user-agent for navigating via link headers
 - Extensibly adds new target environments
 - API to transform link-clicks and form-submits into "request" events which can be routed to Local servers

### Examples

Run servers in the document:

```javascript
local.addServer('foobar', function(req, res) {
    res.writeHead(200, 'ok', { 'content-type': 'text/plain' })
    res.end('Hello, world!');
});
local.dispatch({ method: 'GET', url: 'httpl://foobar' })
	.then(/* ... */);
```

Run servers in Web Workers:

```javascript
local.spawnWorkerServer('http://myhost.com/myworker.js');
local.dispatch({ method: 'GET', url: 'httpl://myworker.js' })
    .then(/* ... */);
```

Run servers for other users on Grimwire:

```javascript
// Get access to the relay
var relay = local.joinRelay('https://grimwire.net', peerServerFn);
relay.requestAccessToken(); // this will prompt the user to authorize the app
relay.on('accessGranted', function() {
    peerRelay.startListening();
});

// Serve peers
function peerServerFn(req, res, peer) {
    res.writeHead(200, 'ok', { 'content-type': 'text/plain' })
    res.end('Hello, '+peer.getPeerInfo().user);
}

// Contact peers on the relay
local.dispatch({ method: 'GET', url: 'httpl://bob@grimwire.net!bobs-app.com' })
    .then(/* ... */);
```

Programmatically navigate Web APIs (based on the [Web Linking spec](http://tools.ietf.org/html/rfc5988)):

```javascript
// Register an in-document server:
local.addServer('foo', function(req, res) {
    if (req.path == '/') {
        res.writeHead(200, 'ok', {
            'content-type': 'text/plain',
            'link': [
            	'</>; rel="self service"',
            	'</bar>; rel="item"; id="bar"'
            ].join(',')
        });
        res.end('Hello from /');
    } else if (req.path == '/bar') {
        res.writeHead(200, 'ok', {
            'content-type': 'text/plain',
            'link': [
            	'</>; rel="up service"',
            	'</bar>; rel="self item"; id="bar"'
            ].join(',')
        });
        res.end('Hello from /bar');
    } else {
        res.writeHead(404, 'not found').end();
    }
});

// Create an agent for the server and dispatch a GET:
var fooAPI = local.agent('httpl://foo');
fooAPI.get().then(/* ... */); // => "Hello from /"

// Navigate by searching the link header of the response:
var fooBarItem = fooAPI.follow({ rel: 'item', id: 'bar' });
fooBarItem.get().then(/* ... */); // => "Hello from /bar"

// Follow the "up" link back to the root:
fooBarItem.follow({ rel: 'up' }).get().then(/* ... */); // => "Hello from /"
```


## How it works

Local.js starts with its dispatch() function, which parses the target URL and routes according to the scheme. 'http:' is handled using XMLHttpRequest, 'data:' is parsed and sent back, and 'httpl:' sends the request to a function registered in the local domain map. In the httpl case, the function is given request and response objects which provide stream interfaces similar to that of node.js.

Special httpl server functions called "bridges" can be established over messaging channels to other environments. They serialize the requests' messages to JSON, send them over the channel, then deserialize them to generate a response*. This is how Workers and WebRTC peers are targeted.

* JSON was ultimately chosen for its de/serialization speed over other options in the browser.


## Getting Started

Download local.js or local.min.js and add either to your application to use the library, then read through the documentation at grimwire.com/local to get familiar with the API and concepts. If you're developing for Grimwire, download grimwidget.js and read the sections on Developing for Grimwire.


## Special thanks and credits

Thank you to the following third-party library authors:

 - [**parseUri**](http://stevenlevithan.com/demo/parseuri/js/), Stephen Levithan
 - [**UriTemplate**](https://github.com/fxa/uritemplate-js), Franz Antesberger
 - **TODO** anybody else

Additional thanks to [Goodybag](http://goodybag.com) for their support during the development of this project. If you're in Austin and need food delivered to the office, they've got a great selection of restaurants and menus inside a slick interface for lunches without the hassle.


## License

The MIT License (MIT)
Copyright (c) 2013 Paul Frazee

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
