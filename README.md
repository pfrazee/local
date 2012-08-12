LinkShUI
========

A CLI-driven browser application made to give the user control over their software.

## Overview

*Link* is an experimental app architecture that uses the REST service structure to organize its software. It is designed to create a highly-composable, Web-focused environment for information work.

The philosophy behind Link is [strongly influenced by Unix](http://en.wikipedia.org/wiki/Unix_philosophy). This translates with some small differences: whereas Unix is file-centric, Link is all about resources. More unusually, however, Link does not have a traditional "program" concept. Rather, Link segments the document into multiple "agents" which can potentially receive a new state from any service. A locally-served inbox list, for instance, can transfer to a message view supplied remotely. As a result, resources (and their services) are built to handle the narrowest task-definition possible, in keeping with the "small and specific" philosophy of Unix.

## How does it work?

LinkShUI uses [RequireJS](http://requirejs.org) to load a configured set of modules into a URI structure. Those modules then use [LinkJS](http://github.com/pfraze/linkjs) to communicate with the environment, remote services, and each other using an HTTP-like API. Typically, the modules issue requests to remote services and use the returned data to serve GUIs.

The environment (LinkShUI) listens to link clicks, form submits, and CLI commands and converts them into new requests for LinkJS to route. The DOM is divided into multiple isolated "agents" which receive the responses. If given the (application/html+json)[https://github.com/pfraze/application-html-json] content-type, the agent will call its "onload" script, which allows the response to set up a custom Agent program.

LinkShUI is in early beta, so expect API and runtime instability. These instructions are geared toward developers who wish to experiment with the software and possibly build their own modules and services.

## Getting Started

LinkShUI will eventually use a configuration-package system for users to create and distrubute environments. At this stage in development, it stores a single config in a javascript object within index.html.

The application is a static set of html, js, css, and image assets which can be served directly by Apache. All of the in-browser servers (the JS modules) should work out of the box. Remote services, however, require some setup due to CORS. LinkShUI offers three options:

First is the /serv directory, which provides a simple routing system (via mode_rewrite and the `index.php`) for PHP web services. The repository currently includes `files.php` which serves everything under `/serv/_files/` with GET and PUT methods. `index.php` will route all requests to `/serv/files` to that service. (This should also work out of the box, but make sure htaccess files are turned on, and that the apache process-owner has read/write permissions to `/serv/_files`.)

Second is the Apache proxy config, which must be set within the host config (not htacess). Here is an example config from the dev machine:

```
# Service proxies
ProxyRequests Off
ProxyPreserveHost On
<Proxy *>
    Order allow,deny
    Allow from all
</Proxy>
ProxyPass /serv/maildir http://localhost:8600
ProxyPassReverse /serv/maildir http://localhost:8600
ProxyPass /serv/statusnet http://localhost:83
ProxyPassReverse /serv/statusnet http://localhost:83
```

Third is the generic proxy, which is configured in `main.js` to be used by LinkJS during ajax when the URI starts with the protocol (http://). The proxy's code is found in `/serv/proxy.php` (based on [Ben Alman's Simple Proxy script](https://github.com/cowboy/php-simple-proxy)). If using LinkShUI publicly, this option might be hard on your server's bandwidth, and it does completely circumvent the CORS security.

Of course, if a target service in another domain offers a [permissive CORS policy](https://www.google.com/search?q=CORS+ajax), the proxy shouldnt be necessary.

Instructions to set up webmail using postfix can be found in the [Maildir Service repository](https://github.com/pfraze/maildir-service).

## Using the Shell

To use LinkShUI effectively, you have to use the command-line. The syntax builds HTTP requests which are issued on behalf of active agents in the environment. (Think of agents as sub-browsers in the browser.)

```[ agent ">" ] [ method ] uri [ "[" content-type "]" ]```

The default agent is '.'; the default method is 'get'; and the default content-type is 'application/html+json'. To help clarify this, here are some examples:

```
agent1>get /user [application/json]
/agent1/more
close /agent1
```

All of the above are valid requests. If the receiving agent doesnt already exist, it will be created in the document. Every agent intercepts requests made on their behalf, then decides how to execute them. This is so they can interpret the request and its response. (For example, `pfraze/liftbox.js` interprets json to populate its GUI.)

Agents also have the ability to serve their own resources. In that case, their URIs live under the agent name. (e.g. If `agent1` serves `/more` and `/less`, then those URIs would be found at `/agent1/more` and `/agent1/less`). This creates an interface for the user and other agents to run requests.

A typical flow, then, would be to open a program under a named agent, then begin interacting with that agents resources. For instance:

```
m>/tools/inbox       -- tools/inbox refers to an in-browser server module
check /m/1-5         -- issue a request with the "CHECK" method to messages 1-5
mr /m/checked        -- mark the checked messages as "read"
close /m             -- issue a "CLOSE" request to the m agent 
```

You can leave out the URI's leading slash, for convenience:

```
m>tools/inbox
check m/1-5
mr m/checked
close m
```

The available requests depend entirely on the active programs. The only methods which can be universally expected are `close`, `min`, and `max`, which are provided by the evironment's agent server to, respectively, close, minimize, and unminimize agents.

Notice that, in that example, only the first request specifies a receiving agent. The remaining 3 default to the '.' agent, which tends to be replaced frequently while the user works. In the above example, none of the responses after the `tools/inbox` request were important to the user, so they were allowed to default to the '.' agent.

If you need to get a better idea of how this works, [watch this demonstration of the shell](#TODO).

## Developing for the platform

<https://github.com/pfraze/linkshui/wiki>

## Frequently Experienced Frustrations

**Theres no per-agent history, you jerk.** Not yet. There is, however, command history with the up/down keys.

**Hey, you goon, there's no pipe-and-filter!** Actually, there was once, and, ye, there shall verily be again. But I want to let the agent system mature a bit first. (Should they interpret every request? How would piping work then? You see what I mean.)

**No auto-complete, no `ls` -- how am I supposed to discover the environment, huh?** Oooh, yeaaah, you kind of have to live with that for the moment. I've been designing GUIs to state the requests that will occur when used (for instance, the button to send a reply is labeled "post /re"). I want to get a feel for what's needed before I start forcing in a reflection system.

**This thing is a far cry from a desktop environment, buddy.** Yeah, it's not meant to be.LinkShUI is a configurable web application--it's just there to let you control what's inside the browser tab. Eventually, users will configure a bunch of different environments that they can open separately, but which can share remote resources. That way, 'shui can enforce agent layouts or server compositions that make sense for the application. You'll have your messaging environment, your coding environment, your data-manip environment... each in a different tab!

## Getting Help

[The LinkShUI Google Group](https://groups.google.com/forum/#!forum/linkshui) is available for support and development questions.

## License

The MIT License (MIT)
Copyright (c) 2012 Paul Frazee

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
