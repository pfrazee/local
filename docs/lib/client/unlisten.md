```javascript
var el = document.getElementById('target-region');
local.client.unlisten(el);
```

<br/>
#### local.client.unlisten( <small>element</small> ) <small>=> undefined</small>

Stops listening for 'click' and 'submit' events, and unregisters any other handlers that may have been set on the region and its children.