Link.Router
===========

pfraze 2013


## Overview

Router is a wrapper interface for handling requests. It executes callbacks by pattern-matching against the request, and it helps generate the error response after a request goes unmatched.

Router provides four different match functions: 'path' (p), 'method' (m), 'accept' (a), and 'content-type' (t). It combines those functions into an incomplete set of likely combinations (p, pm, pma, pmat, pmta, pmt, pa, pt, m, ma, mat, mta, mt, mp, mpa, mpt, mpat, mpta, a, at, t) for matching against. You may pass a string (for exact matches) or a regex, and the matches will be passed to the callback:

```javascript
var router = Link.router(request);
router.pm('/', /HEAD|GET/, self.handleListCollections.bind(self, request, respond));
router.pm(RegExp('^/(\w+)/?$','i'), /HEAD|GET/, function(match) {
	var collectionId = match.path[1];
	self.handleGetCollection(request, respond, collectionId);
});
router.pm(RegExp('^/(\w+)/(\w+)/?$','i'), /HEAD|GET/,function(match) {
	var collectionId = match.path[1];
	var itemId = match.path[2];
	self.handleGetItem(request, respond, collectionId, itemId);
});
router.error(response); // will generate a 404: not found or 405: method not allowed
```

The router tracks which partial hits occur and uses that information to produce the error response. In the example above, if the path hits but the method doesn't, a 405 will be created.

When a route hits, further routes will not execute. However, routes within the callback will. This allows multi-layer routing:

```javascript
router.pm('/', 'GET', function() {
	// ...
	router.a(/html/, function() {
		// ...
	});
	router.a(/json/, function() {
		// ...
	});
	router.error(response, ['path', 'method']); // will generate 406: not acceptable
});
router.error(response); // will generate 404: not found
```

Currently, when in a callback you must pass `error()` an array of the parameters matched by the parent router call in order to generate the correct response.


## API

### Link.router( <small>request</small> ) <small>=> router</small>

Creates a new `Router` object for the request.

### p/m/a/t( <small>selectors..., callback</small> ) <small>=> router</small>

Takes one selector (regex or string) for each character in the name, plus a callback which is run if the request matches all of the given selectors. The characters map to the parameter according to:

 - p = path (aka url)
 - m = method
 - a = accept header
 - t = content-type header

A call to `pmat()` would expect 4 selectors (in the order of path, method, accept, and type) and a callback.

### error( <small>response, [previousMatches]</small> ) <small>=> undefined</small>

This function responds to the request with the best possible error code it can, based on the matches of the route (combined with the `previousMatches` parameter, if provided). It considers some misses more important than others; for instance, a '404 not found' will be generated before a '406 not acceptable'.

The logic is as follows, in this order:

 - Path not matched: 404 not found
 - Method not matched: 405 method not allowed
 - Content-Type not matched, request body given: 415 unsupported media type
 - Accept not matched, accept header given: 406 not acceptable