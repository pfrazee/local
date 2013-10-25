Promises
========

---

Asyncronous wrapper for values which are not yet available.

```javascript
local.promise(local.http.dispatch(request))
  .succeed(updateUI)
  .fail(goErrorState)
  .always(respond);
```

### local.promise(<span class="muted">value</span>)

 - `value`: optional any, behaves according to the following rules:
   - If `value` is a promise, returns that promise
   - If `value` is not a promise, returns a promise fulfilled with that value
   - If `value` is undefined, returns an unfulfilled promise
   - If multiple arguments are given, will return `local.promise.bundle(arguments)`
 - returns `local.Promise`

---

### local.promise.bundle(promises, <span class="muted">shouldFulfillCb</span>)

 - `promises`: required array
 - `shouldFulfillCb`: optional function (promises, rejecteds)
 - returns `local.Promise`

General-purpose tool for combining multiple promises into one.

`shouldFulfillCb` is called once all promises have resolved. It is given an array of all the given promises (with order maintained) and an array of just the promises which were rejected. It should return true to fulfill and false to reject.

---

### local.promise.all(promises)

 - `promises`: required array
 - returns `local.Promise`

Bundles an array of promises into a single promise that requires all to succeed for fulfillment.

---

### local.promise.any(promises)

 - `promises`: required array
 - returns `local.Promise`

Bundles an array of promises into a single promise that requires one to succeed for fulfillment.

## local.Promise

The promise prototype. Use `local.promise()` to instantiate it.

### .then(<span class="muted">fulfillCb</span>, <span class="muted">rejectCb</span>)

 - `fulfillCb`: optional function(v)
 - `rejectedCb`: optional function(v)
 - returns `local.Promise`

When called, if the promise is unfulfilled, the callbacks are queued. Otherwise, the callbacks are called on the next tick.

Returns a promise which will be filled with the return value of the fulfill/reject cbs.

---

### .succeed(fulfillCb)

 - `fulfillCb`: required function(v)
 - returns `local.Promise`

Sugar for `promise.then(fulfillCb, null)`

---

### .fail(rejectedCb)

 - `rejectedCb`: required function(v)
 - returns `local.Promise`

Sugar for `promise.then(null, rejectedCb)`

---

### .always(cb)

 - `cb`: required function(v)
 - returns `local.Promise`

Sugar for `promise.then(cb, cb)`

---

### .fulfill(value)

 - `value`: required any
 - returns `this`

If the promise is not yet filled, sets the value and calls the queued fulfill callbacks.

---

### .reject(value)

 - `value`: required any
 - returns `this`

If the promise is not yet filled, sets the value and calls the queued reject callbacks.

---

### .cancel()

 - returns `this`

Releases any queued callbacks, and instructs downstream promises to cancel as well.

---

### .chain(otherPromise)

 - `otherPromise`: required `local.Promise`
 - returns `otherPromise`

Queues success and fail functions which will, respectively, fulfill or reject `otherPromise`.

---

### .cb(<span class="muted">err</span>, <span class="muted">value</span>)

 - `err`: optional any
 - `value`: optional any

A node-style function which will reject if `err` is truthy and fulfill with `value` otherwise.

---

### .isUnfulfilled()

 - returns bool

---

### .isFulfilled()

 - returns bool

---

### .isRejected()

 - returns bool