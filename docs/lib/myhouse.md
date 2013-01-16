Using MyHouse, the Worker manager
=================================

pfraze 2013


## Overview

A library for sandboxing untrusted code in a web worker.

```javascript
var sandbox = new MyHouse.Sandbox(function() {
	// worker ready

	// disable APIs within the worker
	sandbox.nullify('XMLHttpRequest'); // no ajax

	// load scripts into the worker's namespace
	sandbox.importScripts('/my/script.js');
	sandbox.importScripts(my_data_URI_with_JS_in_it);
	sandbox.importScripts(['path1.js', 'path2.js']);

	// communicate
	sandbox.postMessage('my-message', { foo:'bar' });
	sandbox.onMessage('syn', function(message) {
		sandbox.postReply(message, 'ack');
	});

	// destroy
	sandbox.terminate();
});

```


## Messaging

MyHouse's main feature is a named-message protocol for `postMessage()` which implements replies and streaming.

Every message is assigned an id when dispatched. A 'reply' message refers to that id in its `reply_to` attribute. After a 'reply' message is handled, its callback is dropped.

```javascript
// in the document
function onReply(replyMessage) {
    console.log(replyMessage);
}
sandbox.postMessage('mymessage', { foo:'bar' }, onReply); // => returns message id - eg 5

// in the worker
app.onMessage('mymessage', function(msg) {
    app.postReply(msg.id, 'reply body'); // => returns message id - eg 54
});

// logs:
// => { id:54, reply_to:5, name:'reply', data:'reply body' }
```

Message streams use the id (of the originating message) as their name to post more data. Receivers handle this by listening for messages with the name of the message id. The sender then dispatches an 'endMessage' message for the stream, which is caught by MyHouse and sent to the stream handler.

```javascript
// in the document
var msg = sandbox.postMessage('mystream');
sandbox.postMessage(msg.id, 1);
sandbox.postMessage(msg.id, 2);
sandbox.postMessage(msg.id, 3);
sandbox.endMessage(msg.id);

// in the worker
app.onMessage('mystream', function(openMsg) {
    // start listening for more data
    app.onMessage(openMsg.id, function(streamMsg) {
        if (streamMsg.name == 'endMessage') { console.log('closed'); }
        else { console.log(streamMsg.data); }
    });
});

// logs:
// => 1
// => 2
// => 3
// => closed
```


## API

### Sandbox( <small>[readyCb], [options]</small> )

`readyCb` is registered to the `ready` message, which the worker fires once its MyHouse code has finished loading.

`options` may include:

 - `log:true` to log all messages received and sent by the `Sandbox` instance

### Sandbox#postMessage( <small>name, data, replyCb, replyCbContext</small> ) <small>=> messageId</small>

`replyCb` is called if the receiver posts a reply to the message. (This is the only way to receive replies, and will only work once before the `replyCb` is unregistered.)

### Sandbox#postReply( <small>orgMessage, data, replyCb, replyCbContext</small> ) <small>=> messageId</small>

### Sandbox#endMessage( <small>messageId</small> ) <small>=> messageId</small>

### Sandbox#addMessageListener/onMessage( <small>name, func, context</small> ) <small>=> undefined</small>

### Sandbox#removeMessageListener( <small>name, func</small> ) <small>=> undefined</small>

### Sandbox#removeAllMessageListeners( <small>name</small> ) <small>=> undefined</small>

### Sandbox#bufferMessages( <small>name</small> ) <small>=> undefined</small>

Queues all messages of the given name until `releaseMessage()` is called with the same name.

### Sandbox#releaseMessages( <small>name</small> ) <small>=>undefined</small>

Posts all queued messages of the given name and stops buffering in the future.

### Sandbox#nullify( <small>objectName</small> ) <small>=>undefined</small>

Sends a message to the worker which then does:

```javascript
self[objectName] = null;
```

Use this to disable APIs which should not be available in the worker.

### Sandbox#importScripts( <small>urls</small) <small>=>undefined</small>

Sends a message to the worker which then does:

```javascript
importScripts(urls);
```

### Sandbox#terminate() <small>=>undefined</small>

Destroys the worker.