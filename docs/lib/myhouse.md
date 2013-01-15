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
