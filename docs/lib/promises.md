```javascript
local.promise(local.http.dispatch(request))
  .succeed(updateUI)
  .fail(goErrorState)
  .always(respond);
```

<br/>
### Promise

The promise prototype. Use `local.promise()` to instantiate it.

<br/>
#### local.promise( <small>[value]</small> ) <small>=> local.Promise</small>

 - If multiple arguments are given, will return `local.promise.bundle(arguments)`
 - If `value` is a promise, returns that promise
 - If `value` is not a promise, returns a promise fulfilled with that value
 - If `value` is undefined, returns an unfulfilled promise

<br/>
#### local.promise.bundle( <small>promises, [shouldFulillCb]</small> ) <small>=> local.Promise</small>

General-purpose tool for combining multiple promises into one. `promises` should be an Array. `shouldFulfillCb` is an optional function which is called once all promises have resolved. It is called with `(promises, fails)` - the first is an Array of resolved promises (with order maintained) and the latter is promises which were rejected. `shouldFulfillCb` should return true to fulfill and false to reject.

<br/>
#### local.promise.all( <small>promises</small> ) <small>=> local.Promise</small>

Bundles an array of promises into a single promise that requires all to succeed for fulfillment.

<br/>
#### local.promise.any( <small>promises</small> ) <small>=> local.Promise</small>

Bundles an array of promises into a single promise that requires one to succeed for fulfillment.

<br/>
#### local.Promise#then( <small>[successCb]</small>, <small>[failCb]</small> ) <small>=> local.Promise</small>

 - If the promise is unfulfilled, queues the callbacks
 - Otherwise, execs the callbacks on next tick with the promise's value

Returns a promise which will be filled with the return value of the success/fail cbs.

<br/>
#### local.Promise#succeed( <small>successCb</small> ) <small>=> local.Promise</small>

Sugar for `promise.then(successCb, null)`

<br/>
#### local.Promise#fail( <small>failCb</small> ) <small>=> local.Promise</small>

Sugar for `promise.then(null, failCb)`

<br/>
#### local.Promise#always( <small>cb</small> ) <small>=> local.Promise</small>

Sugar for `promise.then(cb, cb)`

<br/>
#### local.Promise#fulfill( <small>value</small> ) <small>=> this</small>

If the promise is not yet filled, sets the value and calls the queued success callbacks.

<br/>
#### local.Promise#reject( <small>value</small> ) <small>=> this</small>

If the promise is not yet filled, sets the value and calls the queued fail callbacks.

<br/>
#### local.Promise#cancel( <small>value</small> ) <small>=> this</small>

Releases any queued callbacks, and instructs downstream promises to cancel as well.

<br/>
#### local.Promise#chain( <small>otherPromise</small> ) <small>=> otherPromise</small>

Queues success and fail functions which will, respectively, fulfill or reject `otherPromise`.

<br/>
#### local.Promise#cb( <small>err, value</small> ) <small>=> undefined</small>

A node-style function which will reject if `err` is truthy and fulfill with `value` otherwise.