Promises
========

pfraze 2013


## Overview

Monadic function chaining around asynchronously-fulfilled values.

A promise can be created with or without a value:

```javascript
var p1 = promise(); // unfulfilled
var p2 = promise('foobar'); // fulfilled
var p3 = promise(p2); // passes through (p3 === p2)
```

Functions may be chained using `then` (for non-erroneous values) or `except` (for erroneous values). Each function will receive the current value as the first parameter, and must return a value in order to continue the chain.

```javascript
var myPromise = promise();
myPromise.then(function(v) {
	return v + 1;
}).then(log);
promise.fulfill(5);
// => logs "6"
```

The current promise is bound to `this` within the `then` and `except` functions. If a function does not return a value, it may later continue the chain by calling `this.fulfill` or `this.reject`.

```javascript
var myPromise = promise();
myPromise.then(function(v) {
	var self = this;
	setTimeout(function() { self.fulfill(v + 1); }, 1000);
}).then(log);
promise.fulfill(5);
// => logs "6" after a 1-second delay
```

If an `Error` type or subtype is returned, the promise will use that to reject.

```javascript
var myPromise = promise();
myPromise.then(function(v) {
	return new Error("Oh noooo");
}).except(log);
promise.fulfill(5);
// => logs "Error: Oh noooo"
```

Extra parameters may be passed to a `then` or `except` call:

```javascript
function add(a, b) { return a + b; }
function subtract(a, b) { return a - b; }
function wait(v, t) { var self = this; setTimeout(function() { self.fulfill(v); }, t); }
function log(v) { console.log(v); }

promise(10)
	.then(add, 5)
	.then(wait, 1000)
	.then(subtract, 10)
	.then(log);
// => waits 1 second, then logs "5"
```

Promises may be chained, to allow the fulfillment or rejection of one to be passed on to the other:

```javascript
var p1 = promise(), p2 = promise();
p2.then(log).except(log);
p1.chain(p2);
p1.fulfill('foobar');
// => logs "foobar"
```

If a promise is not going to continue the chain, and wants to release the references held by downstream promises, it may call cancel:

```javascript
mypromise
  .then(function(canStop) {
    if (canStop) {
      // program logic says we're done
      console.log('stopping');
      this.cancel();
    } else {
      return 'foobar';
    }
  })
  .then(function(v) {
    console.log(v);
  });
mypromise.fulfill(true);
// => logs "stopping"
```