Local 0.2.0
===========

pfraze 2013

 > It is recommended that you view this documentation from within Local rather than Github, as Github does not always handle relative links as expected. You may view the docs by hosting the codebase and navigating to its `docs.html` page.


## Overview

Local is a framework for safely running user applications on the page using Web Workers.

Some terminology:

 - The "environment" is the document
 - "Applications" are javascript programs run in Web Workers
 - "HTTPL" (HTTP Local) is the protocol for servers hosted in the document or in Web Workers


## About Local

Local lets you separate the user interface from the Web service. It can be used to create configurable site designs, modular single-page applications, and hosted environments for user-applications.

Local builds on the [Service-Oriented Architecture](http://en.wikipedia.org/wiki/Service-oriented_architecture) by allowing browser-side javascript to respond to Ajax requests. This causes applications to behave as zero-latency Web servers, providing JSON resources to each other and responding with HTML to the document's requests. The document is then segmented into independent regions which browse the applications' resources.

To maintain page security, user applications are isolated into Web Workers and communicated with via HTTPL messages. Using routing policies, the environment regulates the access and permission of its applications, enabling users to load programs without risking session- or data-comprimise. [Content Security Policies (CSP)](https://developer.mozilla.org/en-US/docs/Security/CSP) are additionally used to stop inline scripts from executing in the page.

 > Read more: [Worker Security](apps/security.md)

Because applications can't touch the document, the environment has to handle it for them. Rather than binding to events, the applications set their links and forms to target "httpl://" addresses. The click and submit events are translated into local requests, and their responses are used to update the originating client region. Additionally, servers (both local or remote) can trigger GET requests in the client using Server-Sent Events, which can be used to implement realtime updates.

 > Read more: [DOM Interactions via the Common Client](apps/dom_behaviors.md)


## Why Local?

Local was built with a number of goals in mind:

 - Better organization of JS in the browser
 - No tight coupling between the interface and a web service
 - Safe execution of untrusted code

It was first built to address the lack of user-extensibility for modern Web applications: with a strong framework for organizing and configuring the client, users can assemble private and public services into safe and personal tools.

Local is also easy enough to use for simple apps. This 'docs.html' page, for example, is a reusable markdown-browser at ~50 lines of javascript (not including dependencies). It works by browsing the 'apps/util/markdown.js' server, which proxies to the .md files on the remote host and converts the response to HTML. \

 > Read More: [Examples](examples/readme.md)


## Getting Started

Local can be statically hosted after a clean checkout using any Web server. In order to use some example features (such as the [Mozilla Persona](http://www.mozilla.org/en-US/persona/) library), PHP and SQLite3 support are required.

```bash
git clone --recursive https://github.com/pfraze/local.git
make
python -m SimpleHTTPServer
# navigate browser to localhost:8000
```

You'll find a number of example pages (index.html, profile.html, docs.html) applications (apps/social/wall.js) and environment libraries (env/localstorage.js, env/persona.js, env/reflector.js) to learn from in addition to this documentation.


## Further Topics

 - The Environment
   - [**Getting Started**](env/getting_started.md)
   - [Building In-Document Servers](env/document_servers.md)
   - [Mediating Traffic for Security and Privacy](env/mediating_traffic.md)
   - [Adding Widgets and Client Behaviors](env/adding_widgets.md)
 - Worker Applications
   - [Worker Security](apps/security.md)
   - [**Building an Application**](apps/building.md)
   - [Server-Sent Events](apps/events.md)
   - [**DOM Interactions via the Common Client**](apps/dom_behaviors.md)
   - [Worker Protocol](apps/worker_protocol.md)
 - Libraries
   - [Using Promises, the flow-control tool](lib/promises.md)
   - [**Using LinkJS, the HTTP library**](lib/linkjs.md)
   - [Using MyHouse, the Worker manager](lib/myhouse.md)
   - [Using CommonClient, the standard DOM behaviors](lib/commonclient.md)
   - [**Using the Environment API**](lib/environment.md)
 - Examples
   - [index.html](examples/index.md)
   - [profile.html](examples/profile.md)
   - [docs.html](examples/docs.md)
   - [env/localstorage.js](examples/localstorage.md)
   - [env/persona.js](examples/persona.md)
   - [env/reflector.js](examples/reflector.md)
   - [apps/social/wall.js](examples/wall.md)
 - Misc
   - [Building](misc/building.md)
   - [Contributing](misc/contributing.md)
   - [Browser Support](misc/browser_support.md)