EventEmitter
============

---

Event emitter utility class.

```javascript
var emitter = new local.util.EventEmitter();
emitter.on(['foo', 'bar'], console.log.bind(console, 'foobar'));
emitter.on('baz', console.log.bind(console, 'baz'));
emitter.emit('foo', 'hello');
// => foobar hello
emitter.emit('baz', 'world');
// => baz world
```

### local.util.mixinEventEmitter(obj)

 - `obj`: required object

Calls the EventEmitter constructor on the object and mixes in all of the methods.

## local.util.EventEmitter

### .emit(eventName, <span class="muted">args...</span>)

 - `eventName`: required string
 - `args`: optional, each argument after `eventName` will be applied to the listener functions

Returns `false` if no handlers are registered to the `eventName` and `true` otherwise.

---

### .on/addListener(eventName, listenerFn)

 - `eventName`: required string
 - `listenerFn`: required function
 - returns `this`

---

### .once(eventName, listenerFn)

 - `eventName`: required string
 - `listenerFn`: required function
 - returns `this`

---

### .removeListener(eventName, listenerFn)

 - `eventName`: required string
 - `listenerFn`: required function
 - returns `this`

---

### .removeAllListeners(eventName)

 - `eventName`: required string
 - `listenerFn`: required function
 - returns `this`

---

### .suspendEvents()

Adds to the lock counter on the emitter, causing it to buffers all received events until `resumeEvents()` releases the lock.

---

### .resumeEvents()

Decrements the lock counter. If the lock counter reaches 0, buffered events are fired (in order received) and future events are fired immediately.

---

### .isSuspended()

 - returns bool