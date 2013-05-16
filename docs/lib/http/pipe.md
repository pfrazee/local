```javascript
function headerRewrite(headers) {
  headers['content-type'] = 'text/html';
  return headers;
}
function bodyRewrite(body) {
  return JSON.stringify(body || {})
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;');
}
local.http.pipe(response, local.http.dispatch(jsonRequest), headerRewrite, bodyRewrite);
```

<br/>
#### local.http.pipe( <small>target, source, [headersCb], [bodyCb]</small> ) <small>=> local.Promise</small>

Takes a ServerResponse (`target`) and a ClientResponse (`source`, may be a promise) and pipes the values from `source` into `target`.

 - If `headersCb` is specified, its return value is used as the headers (called with `(headers)`).
 - If `bodyCb` is specified, its return value is used as the body (called with `(body)`).