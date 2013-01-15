Link.Headerer
=============

pfraze 2013


## Overview

Headerer is a wrapper interface for request and response headers. It provides functions to add and manage header values, and to serialize into string standards for use over HTTP/S. It currently provides:

```javascript
var headers = Link.headerer();
headers.setAuth({ scheme:'Basic', name:'pfraze', password:'foobar' });
headers.addLink('http://pfraze.net', 'related', { title:'mysite' });
headers.serialize(); // converts keys to string serializations
// ...
Link.responder(response).ok('html', headers).end(theHtml);
```


## API

### Link.headerer( <small>headerObj</small> ) <small>=> Headerer</small>

### addLink( <small>href, rel, [extra]<small> ) <small>=> this</small>

Adds to the Link header. `extra` may be an object with additional parameters.

### setAuth( <small>auth</small> ) <small>=> this</small>

Sets the Authorization header. The composition of `auth` depends on the scheme in use, but the `scheme` attribute is required. For Basic, the object is `{ scheme:'Basic', name:'pfraze', password:'foobar' }

### serialize() <small>=> this</small>

Converts its attributes into their string representations for sending over the wire.