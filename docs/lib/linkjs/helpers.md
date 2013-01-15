LinkJS Helpers
==============

pfraze 2013


## Overview

Link uses a number of helpers, mainly for dealing with de/serialization.


## API

### Link.parseUri( <small>request / url</small> ) <small> =>url description object</small>

<a target="_top" href="http://stevenlevithan.com/demo/parseuri/js/">parseUri</a> is written by Stephen Levithan. It breaks the input URL into its component parts:

```javascript
console.log(Link.parseUri('http://myserver.com/foobar?q=4'));
// => {anchor: "", query: "q=4", file: "", directory: "/foobar", path: "/foobar" ...}
```

### Link.UriTemplate

<a target="_top" href="https://github.com/fxa/uritemplate-js">UriTemplate</a> was written by Franz Antesberger. It generates URLs using URI Templates and some inputs:

```javascript
Link.UriTemplate.parse('http://myserver.com/{collection}/{?foo,bar}').expand({ collection:'friends', foo:1, bar:'b' });
// => "http://myserver.com/friends/?foo=1&bar=b"
```