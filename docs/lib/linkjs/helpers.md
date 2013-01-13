LinkJS Helpers
==============

pfraze 2013

todo

### Link.parseUri

<a target="_top" href="http://stevenlevithan.com/demo/parseuri/js/">parseUri</a> is written by Stephen Levithan. It breaks the input URL into its component parts:

```javascript
console.log(Link.parseUri('http://myserver.com/foobar?q=4').host); // => 'myserver.com'
```

### Link.UriTemplate

<a target="_top" href="https://github.com/fxa/uritemplate-js">UriTemplate</a> was written by Franz Antesberger. It generates URLs using URI Templates and some inputs:

```javascript
Link.UriTemplate.parse('http://myserver.com/{collection}/{?foo,bar}').expand({ collection:'friends', foo:1, bar:'b' });
// => "http://myserver.com/friends/?foo=1&bar=b"

```

### Link.contentTypes

Remote requests must have their payloads serialized and their responses deserialzed. `Link.contentTypes` provides a registry of de/serializers for various mimetypes. Json and `application/x-www-form-urlencoded` are provided by default.

```javascript
Link.contentTypes.register('application/json',
	function (obj) {
		try {
			return JSON.stringify(obj);
		} catch (e) {
			return '';
		}
	},
	function (str) {
		try {
			return JSON.parse(str);
		} catch (e) {
			return null;
		}
	}
);
Link.contentTypes.serialize({ foo:'bar' }, 'application/json');
// => '{ "foo":"bar" }'
Link.contentTypes.deserialize('{ "foo":"bar" }', 'application/json');
// => { foo:'bar' }
```

De/serializers are chosen by best match, according to the specificity of the provided mimetype. For instance, if 'application/foobar+json' is used, it will search for 'application/foobar+json', then 'application/json', then 'application'. If no match is found, the given parameter is returned as-is.