Local 0.2.0
===========

pfraze 2013

 > It is recommended that you view this documentation from within Local rather than Github, as Github does not always handle relative links as expected. You may view the docs by hosting the codebase and navigating to its `docs.html` page.


## Overview

This document provides an introduction to Local's design. Use it as a starting-point to understanding how Local works. Some terminology:

 - The "environment" is the Javascript which operates in the document's namespace
 - "Applications" are Javascript components which are managed by the environment; typically run in Web Workers
 - "HTTPL" (HTTP Local) is the protocol for local Javascript servers (hosted in the document or in Web Workers)
 - "Widgets" are reusable UI elements; this term is used informally


## About Local

**Local's primary purpose is to separate Web interfaces from services so users may easily replace segments of the page.** It can be used to create customizable web interfaces, reusable client-side applications, online "operating systems," and so on.

To maintain security in the page, replaceable portions of the page are isolated into separate threads (Web Workers) and communicated with via HTTP-style requests. These portions are called "applications." Using smart policies, it's possible for environments to import and sandbox untrusted applications, enabling low-risk software sharing between users and services. [Content Security Policies (CSP)](https://developer.mozilla.org/en-US/docs/Security/CSP) are additionally used to stop inline scripts from executing in the page.

 > Read more: [Worker Security](apps/security.md)

Because applications can't touch the document, the environment has to make UI changes for them. This is simplified by HTTPL, an emulation of HTTP over the Web Worker's `postMessage` interface which allows applications to act as Web servers. HTML then addresses interactions to them using links and forms, which saves applications from having to bind to events. Additionally, a data-binding protocol is available through Server-Sent Events, allowing servers (local and remote) to live-update the page.

 > Read more: [DOM Interactions via the Common Client](apps/dom_behaviors.md)

In order to enforce policies (such as permissions) the environment mediates all traffic and decides whether a request will be fulfilled. Requests to remote services might, for instance, require user confirmation before execution. Credentials (and other sensitive information) can be added to requests at this stage, stopping the sensitive data from ever leaking back into the applications.

 > Read more: [Mediating Traffic for Security and Privacy](env/mediating_traffic.md)

To get started, direct a web server (apache, nginx, etc) to statically host a copy of the repository for development. In order to use some features (such as Persona's account verification), PHP and SQLite3 support are required. Use the existing pages and apps as examples while building your site.


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
   - [env/localstorage.js](examples/localstorage.md)
   - [env/persona.js](examples/persona.md)
   - [env/reflector.js](examples/reflector.md)
   - [apps/social/wall.js](examples/wall.md)
 - Misc
   - [Building](misc/building.md)
   - [Contributing](misc/contributing.md)
   - [Browser Support](misc/browser_support.md)
   - [Horizontal Protocols](misc/horizontal_protocols.md)