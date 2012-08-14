LinkShUI
========

A user-configurable, CLI-driven application platform in the browser. <http://linkshui.com>

## How does it work?

LinkShUI uses [RequireJS](http://requirejs.org) to load a configured set of server modules into a shared URI structure. Those modules then use an HTTP-like API called [LinkJS](http://github.com/pfraze/linkjs) to communicate with remote services, the environment, and each other. This allows the user to assemble Web applications using their personal software and any number of online services.

---

*LinkShUI is in early beta, so expect API and runtime instability. These instructions are geared toward developers who wish to experiment with the software and possibly build their own modules and services.*

---

## Getting Started

LinkShUI will eventually use a configuration-package system for users to create and distrubute environments. At this stage in development, it stores a single config object within `index.html`.

The application is a directory of static assets which can be served directly by Apache. All in-browser servers (the JS modules) should work out of the box. Remote services, however, require some setup due to CORS. LinkShUI offers three options:

First is the /serv directory, which provides a simple routing system (via mod_rewrite and `index.php`) for PHP web services. The repository currently includes `files.php` which serves everything under `/serv/_files/` with GET and PUT methods. `index.php` will route all requests targetting `/serv/files/*` to that script. (Make sure .htaccess files are enabled and that the apache process-owner has read/write permissions to `/serv/_files`.)

Second is the Apache proxy config, which must be set within the host config (not htaccess). Here is an example config from a dev machine:

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

Third is the generic proxy, which is configured in `main.js` to be used by LinkJS if making Ajax calls outside of the domain. The proxy's code is found in `/serv/proxy.php` (based on [Ben Alman's Simple Proxy script](https://github.com/cowboy/php-simple-proxy)). If using LinkShUI publicly, this option might be hard on your server's bandwidth, and it does completely circumvent CORS security.

Of course, if a target service in another domain offers a [permissive CORS policy](https://www.google.com/search?q=CORS+ajax), the proxy shouldnt be necessary.

#### Instructions to set up webmail using postfix can be found in the [Maildir Service repository](https://github.com/pfraze/maildir-service).

## Using the Shell

To use LinkShUI effectively, you have to use the command-line. Its syntax builds HTTP requests which are issued on behalf of active agents in the environment. (Think of agents as sub-browsers in the browser.)

```[ agent ">" ] [ method ] uri [ "[" content-type "]" ]```

The default agent is '.'; the default method is 'get'; and the default content-type is 'application/html+json'. To help clarify this, here are some example commands:

```
agent1>get http://localhost/users [application/json]
/agent1/more [text/html]
close /agent1
```

All of the above are valid requests. If the receiving agent doesnt already exist, it will be created in the document. Every agent intercepts requests made on their behalf, then decides how to execute them. This is so they can interpret the request and its response. (For example, `pfraze/cabinet.js` -- a file browser -- interprets json to populate its GUI.)

Agents also have the ability to serve their own resources. In that case, their URIs live under the agent name. (e.g. If `agent1` serves `/more` and `/less`, then those URIs would be found at `/agent1/more` and `/agent1/less`). This creates an interface for the user and other agents to run requests.

A typical flow, then, would be to open a program under a named agent and begin interacting with that agent's resources. For instance:

```
m>/tools/inbox       -- tools/inbox refers to an in-browser server module
check /m/1-5         -- issue a request with the "CHECK" method to messages 1-5
markread /m/checked  -- mark the checked messages as "read"
close /m             -- issue a "CLOSE" request to the m agent 
```

You can leave out the URI's leading slash, for convenience:

```
m>tools/inbox
check m/1-5
markread m/checked
close m
```

The available requests depend entirely on the active programs. The only methods which can be universally expected are `close`, `min`, and `max`, which are provided by the evironment's core agent server.

Notice that, in the above example, only the first request specifies a receiving agent. The remaining 3 default to the '.' agent, which tends to be replaced frequently while the user works. In the above example, none of the responses after the `tools/inbox` request were important to the user, so they were allowed to default to the '.' agent.

If you need to get a better idea of how this works, [watch this demonstration of the shell](#TODO).

## Going From Here

### [Application Dev Wiki](https://github.com/pfraze/linkshui/wiki)

### [LinkShUI Google Group](https://groups.google.com/forum/#!forum/linkshui)

## Frequently Experienced Frustrations

**Theres no per-agent history, you jerk.** Not yet. There is, however, command history with the up/down keys.

**There's no pipe-and-filter, you jerk** Actually, there was once, and there may be one again, but I want to let the agent system mature a bit first. (Should they interpret every request? How would piping work then? You see what I mean.)

**No auto-complete, no `ls` -- how am I supposed to discover the environment, you jerk?** Yeah, you kind of have to live with that for the moment. I want to get a feel for what's needed before I start forcing in a reflection system.

**This thing is a far cry from a desktop environment, you jerk.** Yeah, it's not meant to be. LinkShUI is a configurable web application--it's just there to let you control what's inside the browser tab. Eventually, users will configure a bunch of different environments that they can open separately, but which can share remote resources. That way, 'shui can enforce agent layouts or server compositions that make sense for the application. You'll have your messaging environment, your coding environment, your news-feed environment... each in a different tab!

## License

The MIT License (MIT)
Copyright (c) 2012 Paul Frazee

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
