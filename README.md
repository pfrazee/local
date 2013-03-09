## Local

Local is a client-side application platform. It allows you to run user programs together on the page with permissions-enforcement and thread-isolation, but without sacrificing the richness and performance of the Web.

**NOTE! Local is not out of beta, and needs to undergo extensive security auditing before use in production. As the project develops, please report any vulnerabilities or weaknesses which you find. This project is currently unfunded, and relies on everybody's good will to make something worth-while. Your help is hugely appreciated!**

### How does it work?

Local uses Web Workers to isolate applications in separate threads, and Content Security Policies to control which scripts are executed. This (according to my research) provides enough safety to run user applications on the page, but makes it hard for those apps to interact with each other or render to the document. To overcome this limitation, Local emulates HTTP over the Workers's messaging system, allowing applications to address each other, communicate, and serve HTML as remote servers do.

Local also provides a number of tools for developing the applications; more details may be found in the [technical documentation](/pfraze/local/blob/v0.2.0/docs/readme.md).

### How do I use it?

`git clone https://github.com/pfraze/local.git mysite`

Have Apache (or any other Web server) host the `mysite` directory, and you should get the documentation and example pages. Then [work your way through the documentation](/pfraze/local/blob/v0.2.0/docs/readme.md) to learn how to construct the page and its applications.


## Third-Party Libraries

Thank you to the following third-party library authors:

 - [**parseUri**](http://stevenlevithan.com/demo/parseuri/js/), Stephen Levithan
 - [**UriTemplate**](https://github.com/fxa/uritemplate-js), Franz Antesberger
 - [**Prism**](https://github.com/LeaVerou/prism), Lea Verou
 - [**Marked**](https://github.com/chjj/marked), Christopher Jeffrey
 - :TODO:


## License

The MIT License (MIT)
Copyright (c) 2012 Paul Frazee

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
