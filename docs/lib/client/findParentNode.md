```javascript
var el = document.getElementById('target-region');
local.client.unlisten(el);
```

<br/>
#### local.client.renderResponse( <small>targetElement, containerElement, response</small> ) <small>=> undefined</small>

Replaces the targetElem's innerHTML with the response payload.

 - Supports "text/html" and "application/html-deltas+json". All other response types are dumped in plaintext after stringifying.
 - Runs `local.env.postProcessRegion()` on affected regions.