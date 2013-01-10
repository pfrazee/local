DOM Interactions via the Common Client
======================================

pfraze 2013


## Overview

This document covers how HTML is rendered on the page and what UI behaviors are implemented. It uses Common Client, which translates DOM events into REST requests, updates the DOM with responses, and uses server event-streams to perform live updates.


## Common Client

**Why?** A challenge for running applications from Web Workers is providing control over the document without having access to the document API. The original approach by Local was to abstract over the document API with an HTTPL server, but the asyncronous calls proved tedious and confused the client/server relationship. This alternative implements generic client-side event behaviors for keeping the interface up-to-date, which maintains client/server flow and simplifies the logic.

More broadly, the creation of client-side data models (in order to create the UI) tends to duplicate work done on the server, produce out-of-band information, and limit the effectiveness of HTTP. Instead, Common Client provides a generic client which is only concerned with reacting to events, issuing requests, and incorporating responses into the interface.

**How?** CommonClient behaves much like the UI bindings in Knockout and Angular, but it follows a different flow. In CC, the client does not develop a concept of the underlying data model; instead, the markup defines events which generate requests, and then designates where the responses should be placed. Here is a simple example, based on a Knockout example:

```html
<form action="httpl://helloworld.ui" onchange="patch">
  <div>
    <p>First name: <input name="firstName" /></p>
    <p>Last name: <input name="lastName" /></p>
  </div>
  <output name="out"><h2>Hello, {{firstName}} {{lastName}}!</h2></output>
</form>
```

This form behaves exactly as the [example from Knockout](http://knockoutjs.com/examples/helloWorld.html), but it does so with a very different process.

 - First, due to the form's `onchange` attribute, modifications to the inputs will result in a PATCH request to "httpl://helloworld.ui".
 - The server living there (which is document-local) will update its data model and broadcast the update via a [server-sent event](https://developer.mozilla.org/en-US/docs/Server-sent_events/Using_server-sent_events). 
 - As the `output` element listens to those events (output elements subscribe to the action URL of their forms) it will then issue a GET request (again, to the form's action URL) with a query parameter noting it's name ("?output=out").
 - The server will then respond with up-to-date HTML for the "out" output element.

All live bindings follow this same pattern of 1) issue change request, 2) receive change event, 3) issue request for updated html.

Of course, some interfaces don't need live updates, and use a more traditional request/response process:

```html
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

Again, this behaves like [the Knockout example it emulates](http://knockoutjs.com/examples/clickCounter.html). Its process is familiar: when a button is clicked, a POST or RESET is sent to the server, and it responds with updated HTML which replaces the entire form.


## Further Topics

 - [Using LinkJS, the HTTP library](../lib/linkjs.md)
 - [Using CommonClient, the standard DOM behaviors](../lib/commonclient.md)
 - [Example: apps/social/wall.js](../examples/wall.md)