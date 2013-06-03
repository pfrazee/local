Local 0.4.0dev
==============

pfraze 2013


## Overview

Local is a framework for running user applications on the page using Web Workers.

Some terminology:

 - The "environment" is the document
 - "Applications" are javascript programs run in Web Workers
 - "HTTPL" (HTTP Local) is the protocol for servers hosted in the document or in Web Workers

## Example

```javascript
// load a local web server into a worker
local.env.addServer('helloworld.usr', new local.env.WorkerServer({
  src: 'data:application/javascript,'+
    'function main(request, response) {'+
      'response.writeHead(200, "ok", {"content-type":"text/html"});'+
      'response.end("<h1>Hello, World!</h1>");'+
    '}'
}));
// send an ajax request to the worker
local.http.dispatch({ method: 'get', url: 'httpl://helloworld.usr' })
  .then(function(res) { console.log(res.body); });
  // => "<h1>Hello, World!</h1>"
```


## Background

The browser is a relatively secure but rigid environment. <a href="http://www.cs.utexas.edu/~mwalfish/papers/zoog-hotnets11.pdf" target="_top">A paper by Microsoft, UT, and Penn researchers</a> lists its traits as Isolated, Rich, On-demand, and Networked (IRON). Broadly speaking, they argue that without the IRON properties, the Web would be too dangerous or too unsophisticated to get any use of.

The browser is bad at injecting its own software. Greasemonkey is limited to UI decoration, and browser apps (which Chrome offers) live in isolation of each other. For sandboxing, the iframe isn't available as it's kept in the same thread as the parent document.

Web Workers, however, <a href="http://stackoverflow.com/questions/12209657/how-can-i-sandbox-untrusted-user-submitted-javascript-content" target="_top">can safely sandbox a script</a> and do not have access to the document or window. To use them, you need a robust messaging protocol in order to create rich applications. Local provides this with a RESTful emulation of HTTP called "HTTPLocal."


## HTTP over Workers

Local builds on the <a target="_top" href="http://en.wikipedia.org/wiki/Service-oriented_architecture">Service-Oriented Architecture</a> by allowing browser-side javascript to respond to Ajax requests. This causes applications to behave as low-latency Web servers, providing JSON resources to each other and responding with HTML to the document's requests. The document is then segmented into independent regions which browse the applications' resources.

To maintain page security, user applications are isolated into Web Workers and communicated with via HTTPL messages. Using routing policies, the environment regulates the access and permission of its applications, enabling users to load programs without risking session- or data-comprimise. <a target="_top" href="https://developer.mozilla.org/en-US/docs/Security/CSP">Content Security Policies (CSP)</a> are additionally used to stop inline scripts from executing in the page.

Because applications can't touch the document, the environment has to handle it for them. Rather than binding to events, the applications set their links and forms to target "httpl://" addresses. The click and submit events are translated into local requests, and their responses are used to update the originating client region. Additionally, servers (both local or remote) can trigger GET requests in the client using Server-Sent Events, which can be used to implement realtime updates.


## Why Local?

Local was built with a number of goals in mind:

 - No tight coupling between the interface and a web service
 - Safe execution of untrusted code
 - Better JS composition in Web Apps

It was first built to address the lack of user-extensibility for modern Web applications: with a strong framework for organizing and configuring the client, users can assemble private and public services into safe and personal tools.

Local is also easy enough to use for simple apps. This 'docs.html' page, for example, is a reusable markdown-browser at ~50 lines of javascript (not including dependencies). It works by browsing the 'apps/util/markdown.js' server, which proxies to the .md files on the remote host and converts the response to HTML.


## Getting Started

Local can be statically hosted after a clean checkout using any Web server.

```bash
git clone https://github.com/grimwire/local.git
python -m SimpleHTTPServer
# navigate browser to localhost:8000
```

If you're new to Local, the best place to start is with <a href="https://github.com/grimwire/grimwire" target="_blank" title="Grimwire">Grimwire</a>, a general-purpose deployment of Local. Grimwire adds configuration management, layout tools, widgets, and other tools which make starting easier. <a href="http://grimwire.github.io/grimwire/" target="_blank" title="Grimwire Nightly Build">Grimwire's Nightly Build</a> includes additional documentation which will help you familiarize with Local.