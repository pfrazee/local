```javascript
var el = document.getElementById('target-region');
local.client.listen(el);
```

<br/>
#### local.client.listen( <small>element</small> ) <small>=> undefined</small>

Converts 'click' and 'submit' events into custom 'request' events.

 - Within the container, all 'click' and 'submit' events will be consumed.
 - 'request' events will be dispatched by the original dispatching element.