![LinkShUI](http://linkshui.com/wp-content/uploads/2012/08/lshui_logo.png)

**An experimental operating environment for applications in the browser.**

LinkShell gives users runtime control over the composition of Web-based programs. It does this by extending the [Service-Oriented Architecture](http://en.wikipedia.org/wiki/Service-oriented_architecture) into the document: [an Ajax library](//github.com/pfraze/linkjs) allows Javascript modules to respond to requests. Active programs publish links to behavior (`GET /messages`, `DELETE /lines/2-30`) and standard servers wrap client resources (the DOM, local storage, etc).

The project objective is to compose behaviors using links (serialized requests) and small, isolated programs. In addition to the services system, LinkShell isolates the document into independent "agents" which are tasked with dispatching the user's requests and interpretting the responses. Programs loaded into the agents can use the traffic to populate its GUI, load new behaviors, or issue further requests.

#### &middot; [Intro Video](http://www.youtube.com/watch?v=CJLiAdYTDz8&feature=g-upl) &middot; [Blog](http://linkshui.com) &middot; [Some](http://linkshui.com/wp-content/uploads/2012/08/3.png) [Screen](http://linkshui.com/wp-content/uploads/2012/08/6.png) [Shots](http://linkshui.com/wp-content/uploads/2012/08/7.png) &middot; 

---

*LinkShUI is in early beta, so expect API and runtime instability. These instructions are geared toward developers who wish to experiment with the software and possibly build their own modules and services.*

---

## Getting Started

The application is a directory of static assets which can be served directly by Apache. All in-browser servers (the JS modules) should work out of the box: just check out into a served directory and load it in your browser.

LinkShUI will eventually use a configuration-package system for users to create and distrubute environments. At this stage in development, it stores a single config object within `index.html`.


## Remote Services

LinkShUI includes a proxy script at `/serv/proxy.php` to get around CORS. Of course, if a target service in another domain offers a [permissive CORS policy](https://www.google.com/search?q=CORS+ajax), the proxy shouldnt be necessary.

The /serv directory provides a simple routing system (via mod_rewrite and `index.php`) for PHP web services. The repository currently includes `files.php` which serves everything under `/serv/_files/` with GET and PUT methods. `index.php` will route all requests targetting `/serv/files/*` to that script.

Make sure .htaccess files are enabled and that the apache process-owner has read/write permissions to `/serv/_files`. Also, if you have problems with the proxy, try adding `php_flag display_errors off` to the .htaccess file.

#### Instructions to set up webmail using postfix can be found in the [Maildir Service repository](https://github.com/pfraze/maildir-service).

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
