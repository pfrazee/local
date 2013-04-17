Using CommonClient, the standard DOM behaviors
==============================================

pfraze 2013


## Overview

CommonClient provides tools to generate `Link` request events out of DOM events (click, submit, change, etc) as well as a standard response-handler which renders to the document. These tools give servers the power to control the document without accessing the API or violating RESTful principles.

 > Read More: [DOM Interactions via the Common Client](../apps/dom_behaviors.md)


## API

### CommonClient.listen( <small>element</small> )

Begins capturing 'click', 'submit', and drag/drop events on `element` and converting them into 'request' events. The 'request' events are dispatched on `element`, and contain a well-formed object in `e.detail` for use in `Link.dispatch()`.

```javascript
CommonClient.listen(element);
element.addEventListener('request', function(e) {
  var request = e.detail;
  // ...
});
```

### CommonClient.handleResponse( <small>targetElem, containerElem, response</small> )

Depending on the status of the response, `handleResponse` will render the body and bind any additional event-listeners. Rendering depends on the response status:

 - 200, the request body will render to the target element
 - 205, if the target element is a form, its content will be reset
 - 303, a new request is dispatched with the URL given in the Location header

This function call is responsible for all `data-subscribe` and `on*` behaviors.