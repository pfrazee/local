```javascript
var res = local.http.dispatch({
  method: 'post',
  url: 'httpl://myserver.com',
  headers: { 'content-type': 'application/json', accept: 'text/html' },
  body: myMessage
});
res.then(continueWork, handleError);
```

<br/>
#### local.http.dispatch( <small>request</small> ) <small>=> local.Promise(local.http.ClientResponse)</small>

Sends a new request and returns a promise for the response. `request` must fit the following schema description:

```
{
  method:  optional string; defaults to 'get',
  url:     string; may be replaced with `host` and `path`,
  query:   optional object; a map of query parameters to add to the url,
  host:    optional string; not needed if `url` is specified,
  path:    optional string; not needed if `url` is specified,
  headers: optional object; should include a (all lower-case) map of headers to values,
  body:    optional object; the request payload,
  stream:  optional boolean; specifies whether the response should be given in chunks
}
```

Requests are sent on the next tick, guaranteeing async.