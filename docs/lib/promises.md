Promises
========

pfraze 2013


Monadic function chaining around asynchronously-fulfilled values. Now with 100% more Promises/A+ conformance.

## Usage

A promise can be created with or without a value:

```javascript
var p1 = new Local.Promise(); // unfulfilled
var p2 = Local.promise(); // unfulfilled
var p3 = Local.promise('foobar'); // fulfilled
var p4 = Local.promise(p2); // passes through (p3 === p2)
var p5 = Local.promise(promiseFromOtherLibrary); // wraps ((p4 instanceof Local.Promise) === true)
```

Functions may be chained using `then`. Each function will receive the current value as the first parameter, and updates the current value with whatever is returned (including `undefined` if no return statement is made).

```javascript
var myPromise = Local.promise();
myPromise.then(
  function(v) {
    return v + 1;
  },
  function(err) {
    // rejection handler, wont get hit this time
  })
  .then(log);
promise.fulfill(5);
// => logs "6"

var myPromise = Local.promise();
myPromise.then(
  function(v) {
    // success handler, wont get hit this time
  },
  function(err) {
    console.log(err);
  });
promise.reject("Oh nooo");
// => logs "Oh nooo"
```

Functions which throw an error will cause the next promise to be rejected. Subsequent rejection handlers can choose to rethrow to continue rejection, or return a value to indicate normal operation has resumed.

```javascript
var myPromise = Local.promise();
myPromise
  .then(function(v) { throw "oh nooo"; })
  .then(null, function(err) { console.log(err); throw "oh nooo!!!"; })
  .then(null, function(err) { console.log(err); return "jk we're fine"; })
  .then(log);
promise.fulfill(true);
// => logs "oh nooo"
// => logs "oh nooo!!!"
// => logs "jk we're fine"
```

In addition to `then`, you can use `succeed` (for non-erroneous values) or `fail` (for erroneous values). The first parameter defines the handler function, and subsequent parameters may be provided to be passed into the handler:

```javascript
function add(v, x) { return v + x; }
function subtract(v, x) { return v - x; }
function wait(v, t) { var self = this; setTimeout(function() { self.fulfill(v); }, t); }
function log(v) { console.log(v); }

Local.promise(10)
  .succeed(add, 5)
  .succeed(wait, 1000)
  .succeed(subtract, 10)
  .succeed(log);
// => waits 1 second, then logs "5"
```

Promises may be chained, to allow the fulfillment or rejection of one to be passed on to the other:

```javascript
var p1 = Local.promise(), p2 = Local.promise();
p2.then(log, log);
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

For cases where you need to support the `(err, result)` pattern, use `nodeStyleCB()`:

```javascript
require('http').request(options, Local.nodeStyleCB(mypromise));
```