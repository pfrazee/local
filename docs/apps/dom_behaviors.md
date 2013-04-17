DOM Interactions via the Common Client
======================================

pfraze 2013


## Overview

This document covers how HTML is rendered on the page and what UI behaviors are implemented.

A challenge for running applications from Web Workers is providing control over the document without having access to the document API. Rather than try to provide an alternate API, Local adds HTML features which give the server tighter control over the document. Except for these key changes, Local applications behave almost exactly like the standard browsers by navigating between resources.


## Request Events

CommonClient intercepts click, submit, and drag/drop events and converts them into custom 'request' events. These events include a request object in the `detail` attribute.

The `Environment.Client` object catches those events and dispatches them:

```javascript
var self = this;
CommonClient.listen(this.element);
this.element.addEventListener('request', function(e) {
  var request = e.detail;

  // sane defaults
  request.headers = request.headers || {};
  request.headers.accept = request.headers.accept || 'text/html';

  // choose the request target
  var requestTarget = document.getElementById(request.target) || self.element;

  // issue request
  Local.promise(Link.dispatch(request, self))
    .succeed(function(res) {
      // success, send back to common client
      res.on('end', function() {
        CommonClient.handleResponse(requestTarget, self.element, res);
        Environment.postProcessRegion(requestTarget);
      });
    });
  e.preventDefault();
  e.stopPropagation();
});
```

`CommonClient.listen()` adds the request event dispatches, and `CommonClient.handleResponse()` renders responses and binds any additional event-listeners. There are some exceptions to this, depending on the response status:

 - 204, no changes are made to the document
 - 303, a new request is dispatched with the URL given in the Location header


## Custom Request Events

While it's not possible for an application to bind directly to events, they can provide instructions for events to dispatch HTTP requests. Doing so requires a form and an `on*` attribute to specify the request method. 

```markup
<form action="http://myhost.com" onchange="patch">
  <!-- ... -->
</form>

<form id="form2" action="httpl://another.host">
  <input type="text" name="foo" onblur="post" />
</form>

<textarea form="form2" name="bar" onchange="post"></textarea>
```

The request is dispatched whenever the element (or any child) fires the event. In the example above, changing any child element of the first form would result in a PATCH to 'http://myhost.com' with the serialized contents of the form. Blurring focus from the 'foo' input would have the same effect, but with a POST to 'httpl://another.host'. It's also possible to designate a form that isn't a parent element, as in the case of the 'bar' textarea.

The following event attributes are supported:

```
onblur, onchange, onclick, ondblclick, onfocus, onkeydown, onkeypress, onkeyup, onload, onmousedown, onmousemove, onmouseout, onmouseover, onmouseup, onreset, onselect, onsubmit, onunload
```


## Triggering Requests from the Server

It's not uncommon for a server to want to update a client's interface. In Local, elements with `data-subscribe` attributes will subscribe to the 'text/event-stream' at the specified url, where they listen for an 'update' event. If the event is received, a GET request will be issued to the same URL for 'text/html' and replace its innerHTML with that result.

```markup
<div data-subscribe="http://somewhere.com">This will be changed on 'update' events!</div>
```


## Data-Binding

Local can produce an effect much like the data-binding in Knockout and Angular, but by using a fairly different process. In Local, the client does not develop a concept of the underlying data model; instead, the markup defines events which generate requests, and then designates where the responses should be placed. Here is a simple example:

```markup
<form action="httpl://helloworld.ui" onchange="patch">
  <div>
    <p>First name: <input name="firstName" /></p>
    <p>Last name: <input name="lastName" /></p>
  </div>
  <h2 data-subscribe="httpl://helloworld.ui?output=greeting">Hello, {{firstName}} {{lastName}}!</h2>
</form>
```

This form behaves exactly as <a target="_top" href="http://knockoutjs.com/examples/helloWorld.html">this example from Knockout</a>, but it does so with a very different process.

 - First, due to the form's `onchange` attribute, modifications to the inputs will result in a PATCH request to "httpl://helloworld.ui".
 - The server living there (which may be local or remote) will update its data model and broadcast the 'update' event via a server-sent event. 
 - As the `h2` element listens to those events (due to its `data-subscribe` attribute) it will then issue a GET request.
 - The server will then respond with up-to-date HTML for the `h2`.

All live bindings follow this same pattern of 1) issue request to change the data, 2) receive the 'update' event, 3) issue request for updated html.

Of course, some interfaces don't need live updates, and use a more traditional request/response process:

```markup
<form action="httpl://clicks.ui" method="post">
  <div>You've clicked {{numberOfClicks}} times</div>
 
  <button {{#if hasClickedTooManyTimes}}disabled{{/if}}>Click me</button>
 
  {{#if hasClickedTooManyTimes}}
    <div>
      That's too many clicks! Please stop before you wear out your fingers.
      <button formmethod="reset">Reset clicks</button>
    </div>
  {{/if}}
</form>
```

Again, this behaves like <a target="_top" href="http://knockoutjs.com/examples/clickCounter.html">the Knockout example it emulates</a>. It behaves like typical forms: when a button is clicked, a POST (or RESET, depending on the button) is sent to the server, and it responds with updated HTML which replaces the entire form.


## Further Topics

 - [Using LinkJS, the HTTP library](../lib/linkjs.md)
 - [Using CommonClient, the standard DOM behaviors](../lib/commonclient.md)
 - [Example: apps/social/wall.js](../examples/wall.md)