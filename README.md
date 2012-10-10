## Link Application Platform

LinkAP is a purely client-side application platform. It allows you to safely run programs together in the browser without involving a remote host.

### How does it work?

LinkAP uses Web Workers to safely isolate applications in separate threads, and Content Security Policies to control which scripts are executed. Because Web Workers have to communicate through `postMessage`, LinkAP adds an HTTP-like API to structure the communication. Each worker program runs a server (under the "lap://" protocol) which can respond to Ajax requests, link clicks, form submits, and any other request-generating action. This allows clients to consume services without caring whether they are local or remote.

### How do I use it?

To use LinkAP, you create an environment that sets the policies and loads the initial applications.

```bash
git clone https://github.com/pfraze/link-ap.git mysite
cd mysite
make
```

Have Apache (or any other Web server) host the `mysite` directory, and you should get a nice welcome page. Modify the files under `/host` to make your environment (`/host/main.js` is a good place to start).

### Read the [Design Document](//github.com/pfraze/link-ap/wiki/Design-Document) to learn more about how LinkAP works.

---

*LinkShell is in beta, so expect runtime, API, and design instability.*

---

## License

The MIT License (MIT)
Copyright (c) 2012 Paul Frazee

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
