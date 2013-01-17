Link.Responder
==============

pfraze 2013


## Overview

Responder is a wrapper interface for responses. It simplifies header-writing and response piping.

To write headers, you can call the `respond()` function like so:

```javascript
Link.responder(response).respond([200, 'ok'], 'text/html', { other:'headers' })
```

Most status codes have been given sugar codes to simplify this:

```javascript
Link.responder(response).ok('html'); // types are aliased -- 'html', 'json', 'xml'
Link.responder(response).notFound();
```

When proxying out to another server, use `pipe`:

```javascript
Link.responder(response).pipe(Link.request(myRequest));
```


## API

### Link.responder( <small>response</small> ) <small>=>Responder</small>

Creates a new `Link.Responder` for the given response.

### respond( <small>status, [type], [headers]</small> ) <small>=> ServerResponse</small>

### ok/notFound/badRequest/...( <small>type, [headers]</small> ) <small>=> ServerResponse</small>

### pipe( <small>response, [headersCb], [bodyCb]</small> ) <small>=> ServerResponse</small>

Pipes the first parameter response data and headers into the responder's wrapped response. If headers have already been written to the internal response, they will not be copied from the given response.

`headersCb` and `bodyCb` are optional functions for processing the headers and response body, respectively. Their first paramter is the data they are modifying, and they must return the updated copy.

### cb( <small>fnName, [type], [headers], [body]</small> ) <small>=> function(v)</small>

Produces a callback to one of the `respond` sugars for use in a promise `then()` or `except()` chain. `fnName` should be a string naming the function (eg 'ok', 'badGateway', 'notFound', etc). More response parameters can be passed optionally.

An example usage from apps/doc/features.js:

```javascript
lsCollection.getJson()
	.then(function(res) {
		respond.ok('html').end(makeDoc('env', request, res.body));
		return res;
	})
	.except(respond.cb('badGateway'));
```


## Respond Functions

The complete list of response sugars:

```javascript
// information
processing           : [102, 'server has received and is processing the request'],

// success
ok                   : [200, 'ok'],
created              : [201, 'request has been fulfilled; new resource created'],
accepted             : [202, 'request accepted, processing pending'],
shouldBeOk           : [203, 'request processed, information may be from another source'],
nonauthInfo          : [203, 'request processed, information may be from another source'],
noContent            : [204, 'request processed, no content returned'],
resetContent         : [205, 'request processed, no content returned, reset document view'],
partialContent       : [206, 'partial resource return due to request header'],

// redirection
multipleChoices      : [300, 'multiple options for the resource delivered'],
movedPermanently     : [301, 'this and all future requests directed to the given URI'],
found                : [302, 'response to request found via alternative URI'],
seeOther             : [303, 'response to request found via alternative URI'],
notModified          : [304, 'resource has not been modified since last requested'],
useProxy             : [305, 'content located elsewhere, retrieve from there'],
switchProxy          : [306, 'subsequent requests should use the specified proxy'],
temporaryRedirect    : [307, 'connect again to different uri as provided'],

// client error
badRequest           : [400, 'request cannot be fulfilled due to bad syntax'],
unauthorized         : [401, 'authentication is possible but has failed'],
forbidden            : [403, 'server refuses to respond to request'],
notFound             : [404, 'requested resource could not be found'],
methodNotAllowed     : [405, 'request method not supported by that resource'],
notAcceptable        : [406, 'content not acceptable according to the Accept headers'],
conflict             : [409, 'request could not be processed because of conflict'],
gone                 : [410, 'resource is no longer available and will not be available again'],
preconditionFailed   : [412, 'server does not meet request preconditions'],
unsupportedMediaType : [415, 'server does not support media type'],
teapot               : [418, 'I\'m a teapot'],
enhanceYourCalm      : [420, 'rate limit exceeded'],
unprocessableEntity  : [422, 'request unable to be followed due to semantic errors'],
locked               : [423, 'resource that is being accessed is locked'],
failedDependency     : [424, 'request failed due to failure of a previous request'],
internalServerError  : [500, 'internal server error'],

// server error
serverError          : [500, 'internal server error'],
notImplemented       : [501, 'server does not recognise method or lacks ability to fulfill'],
badGateway           : [502, 'server received an invalid response from upstream server'],
serviceUnavailable   : [503, 'server is currently unavailable'],
unavailable          : [503, 'server is currently unavailable'],
gatewayTimeout       : [504, 'gateway did not receive response from upstream server'],
insufficientStorage  : [507, 'server is unable to store the representation'],
notExtended          : [510, 'further extensions to the request are required']
```