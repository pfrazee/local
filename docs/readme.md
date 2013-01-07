Local 0.2.0
===========

pfraze 2013

 > It is recommended that you view this documentation from within Local rather than Github, as Github does not always handle relative links as expected.


## Overview

Local's primary purpose is to separate Web interfaces from services so users may easily replace segments of the page. It can be used to create customizable web interfaces, reusable client-side applications, domain-specific application environments, and so on. To protect the user during this process, the changeable portions of the page are isolated into separate threads (in Web Workers) and communicated with via HTTP-style requests. While this does prohibit the apps from directly manipulating the document, a number of tools are provided to keep their functionality rich and simple to develop. These tools include standard client behaviors (Common Client), Web-Worker management (MyHouse), and a fully-featured HTTP library (LinkJS).

As all communication mimics HTTP, HTML elements are able to describe requests to the Javasript services as they do with remote services. This saves applications from binding to events; instead, they respond to requests generated in the document by link clicks, form submits, and so on. Additionally, a data-binding protocol is provided via Server-Sent Events, allowing servers (local and remote) to live-update the page.

In order to enforce permissions between the applications, the environment mediates all traffic and decides whether a request will be fulfilled. Requests to remote services might, for instance, require user confirmation before execution. Credentials may be added to requests at this stage, stopping the sensitive data from ever leaking into the applications. Content Security Policies are additionally used to stop inline scripts from executing.

To get started, direct a web server (apache, nginx, etc) to statically host a copy of the repository for development. In order to use some features (such as Persona's account verification), PHP scripts will need to execute; however, Local is a client-side library, and its pages do not require any pre-processing to load correctly.


## Topics

 - The Environment
   - [Getting Started](env/getting_started.md)
   - [Mediating Traffic for Security and Privacy](env/mediating_traffic.md)
   - [Adding Widgets and Client Behaviors](env/adding_widgets.md)
 - Worker Applications
   - [Building an Application](apps/building.md)
   - [Server-Sent Events](apps/events.md)
   - [DOM Interactions via the Common Client](apps/dom_behaviors.md)
 - Libraries
   - [Using LinkJS, the HTTP wrapper](lib/linkjs.md)
   - [Using MyHouse, the Worker manager](lib/myhouse.md)
   - [Using CommonClient, the standard DOM behaviors](lib/commonclient.md)
 - Examples
   - [env/localstorage.js](examples/localstorage.md)
   - [env/persona.js](examples/persona.md)
   - [env/reflector.js](examples/reflector.md)
   - [apps/social/wall.js](examples/wall.md)
 - Misc
   - [Building](misc/building.md)
   - [Contributing](misc/contributing.md)