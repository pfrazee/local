Page Environment
================

pfraze 2013


## Overview

The "environment" is the web page. It manages the local servers, lays out the document, regulates traffic for security, and maintains the user session. Much of this is handled for you by various APIs, but there are hooks available for customization.


## Instantiating Servers

Local servers may run within the document or within workers. When in the document, they can be used to provide access to document APIs; for instance, you might wrap local storage, WebRTC, or even the DOM with them. Worker servers, meanwhile, are used to run untrusted applications; use them to execute user-programs.

```javascript
// instantiate services
local.env.addServer('localstorage.env', new LocalStorageServer());

// instantiate apps
local.env.addServer('editor.app', new local.env.WorkerServer({ src:'/apps/editor.js' }));
local.env.addServer('files.app', new local.env.WorkerServer({
  src: '/apps/filetree.js',
  dataSource: 'httpl://localstorage.env'
}));
```

The object passed into the `WorkerServer` constructor is mixed into the worker's `local.worker.config` object. 


## Creating Client Regions

Client regions are portions of the DOM which maintain their own browsing context. As a UI component, they behave like IFrames: clicking a link within one will change its contents only. You create and manage them by referring to the ID of their target element; this example would create 2 regions (at '#editor' and '#files'):

```javascript
// load client regions
local.env.addClientRegion('editor').dispatchRequest('httpl://editor.app');
local.env.addClientRegion('files').dispatchRequest('httpl://files.app');
```

[Content Security Policies](https://developer.mozilla.org/en-US/docs/Security/CSP) are used to keep inline scripts from executing. They are currently set using 'meta' tags, but could also be established by response headers.

 > Note, <a target="_top" href="http://caniuse.com/#search=CSP">CSP</a> is a major criteria for [Browser Support](../misc/browser_support.md)