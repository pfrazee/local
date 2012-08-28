![LinkShell UI](http://linkshui.com/wp-content/uploads/2012/08/lshui_logo.png)

**An experimental operating environment for applications in the browser.**

 - Runs multiple programs in a shared tab environment (with security policies & sandboxing on the way)
 - Uses a client/server, RESTful messaging system between browser components, inspired by Plan9's 9P file system
 - Drag-and-drop commands: pick up a link and give it to a program to follow and interpret
 - Works in recent builds of Chrome, probably also Firefox.

LinkShell gives users runtime control over the composition of Web-based programs. It does this by extending the [Service-Oriented Architecture](http://en.wikipedia.org/wiki/Service-oriented_architecture) into the document: [an Ajax library](//github.com/pfraze/linkjs) allows Javascript modules to respond to requests. Active programs publish links to behavior (`GET /messages`, `DELETE /lines/2-30`) and standard servers wrap client resources (the DOM, local storage, etc).

The project objective is to compose behaviors using links (serialized requests) and small, isolated programs. In addition to the services system, LinkShell isolates the document into independent "agents" which are tasked with dispatching the user's requests and interpretting the responses. Programs loaded into the agents can use the traffic to populate its GUI, load new behaviors, or issue further requests.

### [Read a more detailed project description here](https://github.com/pfraze/linkshui/wiki/Social-Computing)

---

*LinkShell is in early beta, so expect API and runtime instability. These instructions are geared toward developers who wish to experiment with the software and possibly build their own modules and services.*

---

## Getting Started

The application is a directory of static assets which can be served by Apache. LinkShell will eventually use a configuration-package system for users to create and distrubute environments. At this stage in development, it stores a single config object within `index.html`.

LinkShell includes a proxy script at `/serv/proxy.php` to get around CORS in debugging. Of course, if a target service in another domain offers a [permissive CORS policy](https://www.google.com/search?q=CORS+ajax), the proxy shouldnt be necessary.

Make sure .htaccess files are enabled and that the apache process-owner has read/write permissions to `/serv/_files`. Also, if you have problems with the proxy, try adding `php_flag display_errors off` to the .htaccess file.

#### Instructions to set up webmail using postfix can be found in the [Maildir Service repository](https://github.com/pfraze/maildir-service).

## [Application Dev Wiki](https://github.com/pfraze/linkshui/wiki)

## License

The MIT License (MIT)
Copyright (c) 2012 Paul Frazee

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
