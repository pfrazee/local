pipe()
======

---

Pipes the response from a request into a destination response.

```javascript
// Fetch JSON and format it for HTML
function headerRewrite(headers) {
  headers['content-type'] = 'text/html';
  return headers;
}
function bodyRewrite(body) {
  return JSON.stringify(body || {})
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;');
}
local.pipe(response, local.dispatch(jsonRequest), headerRewrite, bodyRewrite);
```

---

### local.pipe(targetRes, sourceRes, <span class="muted">headersCb</span>, <span class="muted">bodyCb</span>)

 - `targetRes`: required local.Response, the stream to fill
 - `sourceRes`: required local.Response|promise(local.Response), the stream to draw from
 - `headersCb`: optional function(headers), its return value is used as the headers
 - `bodyCb`: optional function(bdy), its return value is used as the body (called on "data" events)