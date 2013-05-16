```javascript
var emitter = new local.util.EventEmitter();
emitter.on(['foo', 'bar'], console.log.bind(console, 'foobar'));
emitter.on('baz', console.log.bind(console, 'baz'));
emitter.emit('foo', 'hello');
// => foobar hello
emitter.emit('baz', 'world');
// => baz world
```

<br/>
A simple clone of the Node.JS event emitter.

<br/>
#### emit( <small>eventName, args...</small> ) <small>=> true/false</small>

Returns `false` if no handlers are registered to the `eventName` and `true` otherwise.

<br/>
#### on/addListener( <small>eventName, listenerFn</small> ) <small>=> this</small>

<br/>
#### once( <small>eventName, listenerFn</small> ) <small>=> undefined</small>

<br/>
#### removeListener( <small>eventName, listenerFn</small> ) <small>=> this</small>

<br/>
#### removeAllListeners( <small>eventName</small> ) <small>=> this</small>