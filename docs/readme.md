Local 0.2.2
===========

pfraze 2013

 > It is recommended that you view this documentation from within Local rather than Github, as Github does not always handle relative links as expected. You may view the docs by hosting the codebase and navigating to its `docs.html` page.


## Overview

Local is a framework for running user applications on the page using Web Workers.

Some terminology:

 - The "environment" is the document
 - "Applications" are javascript programs run in Web Workers
 - "HTTPL" (HTTP Local) is the protocol for servers hosted in the document or in Web Workers


## **Notice**

Local is not out of beta, and needs to undergo extensive security auditing before use in production. As the project develops, please let us know about any vulnerabilities or concerns you find in the software. Your feedback is hugely appreciated!


## Background

The browser is a relatively secure but rigid environment. <a href="http://www.cs.utexas.edu/~mwalfish/papers/zoog-hotnets11.pdf" target="_top">A paper by Microsoft, UT, and Penn researchers</a> lists its traits as Isolated, Rich, On-demand, and Networked (IRON). Broadly speaking, they argue that without the IRON properties, the Web would be too dangerous or too unsophisticated to get any use of.

The browser is bad at injecting its own software. Greasemonkey is limited to UI decoration, and browser apps (which Chrome offers) live in isolation of each other. For sandboxing, the iframe isn't available as it's kept in the same thread as the parent document.

Web Workers, however, <a href="http://stackoverflow.com/questions/12209657/how-can-i-sandbox-untrusted-user-submitted-javascript-content" target="_top">can safely sandbox a script</a> and do not have access to the document or window. To use them, you need a robust messaging protocol in order to create rich applications. Local provides this with a RESTful emulation of HTTP called "HTTPLocal."


## HTTP over Workers

Local builds on the <a target="_top" href="http://en.wikipedia.org/wiki/Service-oriented_architecture">Service-Oriented Architecture</a> by allowing browser-side javascript to respond to Ajax requests. This causes applications to behave as low-latency Web servers, providing JSON resources to each other and responding with HTML to the document's requests. The document is then segmented into independent regions which browse the applications' resources.

To maintain page security, user applications are isolated into Web Workers and communicated with via HTTPL messages. Using routing policies, the environment regulates the access and permission of its applications, enabling users to load programs without risking session- or data-comprimise. <a target="_top" href="https://developer.mozilla.org/en-US/docs/Security/CSP">Content Security Policies (CSP)</a> are additionally used to stop inline scripts from executing in the page.

 > Read more: [Worker Security](apps/security.md)

Because applications can't touch the document, the environment has to handle it for them. Rather than binding to events, the applications set their links and forms to target "httpl://" addresses. The click and submit events are translated into local requests, and their responses are used to update the originating client region. Additionally, servers (both local or remote) can trigger GET requests in the client using Server-Sent Events, which can be used to implement realtime updates.

 > Read more: [DOM Interactions via the Common Client](apps/dom_behaviors.md)


## Why Local?

Local was built with a number of goals in mind:

 - No tight coupling between the interface and a web service
 - Safe execution of untrusted code
 - Better JS composition in Web Apps

It was first built to address the lack of user-extensibility for modern Web applications: with a strong framework for organizing and configuring the client, users can assemble private and public services into safe and personal tools.

Local is also easy enough to use for simple apps. This 'docs.html' page, for example, is a reusable markdown-browser at ~50 lines of javascript (not including dependencies). It works by browsing the 'apps/util/markdown.js' server, which proxies to the .md files on the remote host and converts the response to HTML.

 > Read More: [Examples](examples/readme.md)


## Getting Started

Local can be statically hosted after a clean checkout using any Web server. It's recommended to embed it as a subrepository to your frontend assets, allowing you to pull updates and change versions without losing changes.

```bash
git clone https://github.com/grimwire/local.git
python -m SimpleHTTPServer
# navigate browser to localhost:8000
```

 You'll find a number of example pages (index.html, profile.html, docs.html) applications (apps/social/wall.js) and environment libraries (env/localstorage.js, env/persona.js, env/reflector.js) to learn from in addition to this documentation.

 *Currently, profile.html is not kept active while server software is in development.*


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