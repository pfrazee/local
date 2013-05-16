```javascript
local.http.joinUrl('httpl://myhost.com/foo/', 'bar/', '/baz');
// => 'httpl://myhost.com/foo/bar/baz'
```

<br/>
#### local.http.joinUrl( <small>url1, url2, ...urlN</small> ) <small>=> string</small>

Combines the given arguments, in order, while making sure each argument is separated by one '/'.