## Local

Local is a JS toolkit for running multiple applications on the page with Web Workers and HTTP. It allows servers to run in browser threads, where they host HTML and act as proxies to remote services. Because the servers are unable to access the document's namespace, execute inline scripts (due to CSP) or break the message routing policies of the host document, they can be used as containers for untrusted software.

#### To learn more, visit the [documentation](http://grimwire.com/local) or the [development blog](http://blog.grimwire.com/#blog.md).


## Getting Started

```
git clone https://github.com/pfraze/local.git local
python -m SimpleHTTPServer
# navigate browser to localhost:8000/local
```


## Third-Party Libraries

Thank you to the following third-party library authors:

 - [**parseUri**](http://stevenlevithan.com/demo/parseuri/js/), Stephen Levithan
 - [**UriTemplate**](https://github.com/fxa/uritemplate-js), Franz Antesberger
 - [**Prism**](https://github.com/LeaVerou/prism), Lea Verou
 - [**Marked**](https://github.com/chjj/marked), Christopher Jeffrey


## License

The MIT License (MIT)
Copyright (c) 2012 Paul Frazee

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
