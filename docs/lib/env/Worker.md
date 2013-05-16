```javascript
var worker = new local.env.Worker();
worker.onNamedMessage('ready', function() {
  worker.nullify('XMLHttpRequest');
  worker.importScripts('http://grimwire.com/servers/foobar.js');

  worker.postNamedMessage('my-message', { foo:'bar' });
  worker.onNamedMessage('syn', function(message) {
    worker.postReply(message, 'ack');
  });
});
```

<br/>
### local.env.Worker( <small>readyCb, [options]</small> )

The prototype for the Web Worker wrapper object.

<br/>
#### local.env.Worker#postNamedMessage( <small>name, data, [replyCb], [replyCbContext]</small> ) <small>=> number</small>

Sends the given message to the Worker.

 - If `replyCb` is given, registers it to handle the reply, if given.
 - Returns the id of the message, which can be used to stream more content.

<br/>
#### local.env.Worker#postReply( <small>orgMessage, data, [replyCb], [replyCbContext]</small> ) <small>=> number</small>

Sends a message using a previously-received message as the name.

 - When a reply is received, reply listeners are unregistered (only one reply can be sent).
 - Returns the id of the reply, which can be used to stream more content.

<br/>
#### local.env.Worker#endMessage( <small>orgMessageId</small> ) <small>=> number</small>

Sends an 'endMessage' message with the given `orgMessageId` as the data, signalling to the receiver that no more data will be streamed using the `orgMessageId` name and the handlers can be removed.

<br/>
#### local.env.Worker#addNamedMessageListener( <small>messageName, handler, [context]</small> ) <small>=> undefined</small>
#### local.env.Worker#onNamedMessage( <small>messageName, handler, [context]</small> ) <small>=> undefined</small>

<br/>
#### local.env.Worker#removeNamedMessageListener( <small>messageName, handler</small> ) <small>=> undefined</small>

<br/>
#### local.env.Worker#removeAllNamedMessageListeners( <small>messageName</small> ) <small>=> undefined</small>

<br/>
#### local.env.Worker#bufferMessages( <small>messageName</small> ) <small>=> undefined</small>

Delays all messages of the given type until `releaseMessages` is called.

<br/>
#### local.env.Worker#releaseMessages( <small>messageName</small> ) <small>=> undefined</small>

Stops buffering and sends all queued messages.

<br/>
#### local.env.Worker#nullify( <small>name</small> ) <small>=> undefined</small>

Instructs the LocalEnvWorker to set the given name to null.

<br/>
#### local.env.Worker#importScripts( <small>urls, [cb]</small> ) <small>=> undefined</small>

instructs the LocalEnvWorker to import the JS given by the URL

- `urls` may be a string or an array of strings, and may contain data-urls of valid JS
- `cb` is called with the respond message
  - on error, .data will be { error:true, reason:'message' }

<br/>
#### local.env.Worker#terminate() <small>=> undefined</small>