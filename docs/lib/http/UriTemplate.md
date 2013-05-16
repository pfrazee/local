```javascript
loca.http.UriTemplate.parse('http://myserver.com/{collection}/{?foo,bar}')
  .expand({ collection:'friends', foo:1, bar:'b' });
// => "http://myserver.com/friends/?foo=1&bar=b"
```

<br />
#### local.http.UriTemplate

Written by Franz Antesberger. Generates URLs using URI Templates and some inputs.

<a target="_blank" href="https://github.com/fxa/uritemplate-js">Read the full reference on GitHub.</a>