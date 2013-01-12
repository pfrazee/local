Using LinkJS, the HTTP wrapper
==============================

pfraze 2013

todo

### Link.Navigator

Navigator is an HTTP agent for consuming services. It provides functions to navigate link headers and to send requests.

Link headers are followed by the `relation()` function, which produces a new `Navigator` with the new context. It doesn't remotely verify the location yet, however. Instead, it stores relations as 'relative' to the previous contexts, then resolves them to 'absolute' (full URLs) when a request is made.

The Link headers are expected to include, minimally, the 'href' and 'rel' attributes. The `href` may use [URI Templates](http://tools.ietf.org/html/rfc6570), which `relation(rel, param, extra)` uses as follows:

```javascript
var myhost = new Navigator('https://myhost.com');

var users = myservice.relation('collection', 'users');
// eg if: Link=[{ rel:'collection', href:'/{collection}' }]
// then: users='https://myhost.com/users'

var me = users.relation('item', 'pfraze');
// eg if: Link=[{ rel:'item', href:'/users/{item}' }, { rel:'service', href:'/' }]
// then: me='https://myhost.com/users'
```

Parameter 1 of `relation` specifies which link to use by matching the 'rel' value. Parameter 2 specifies what to use in the URI Template rendering, using the 'rel' value as the parameter name to replace. Parameter 3 can take an object of extra parameters to use when rendeirng the URI.

If a 'title' attribute is included in a Link header, it will be used as a matching criteria to parameter 2. That is, if `rel="service", title="foobar"`, then `myNavigator.relation('service', 'foobar')` will match it. This can be used as an alternative to URI Templates.

The `request()` function takes the request (optional) and two callbacks: success (status code >=200 & <400) and failure (status code >=400). Within the callbacks, the navigator is bound to 'this',

# :TODO: finish this when it sucks less

The `request()` and `relation()` functions have sugars for, respectively, the request methods and relation types. They can be used to reduce the number of parameters given:

```javascript
var myhost = new Navigator('https://myhost.com');
var me = myhost.collection('users').item('pfraze');

me.get(function(res) {
	// -> HEAD https://myhost.com
	// -> HEAD https://myhost.com/users
	// -> GET  https://myhost.com/users/pfraze

	this.patch({ body:{ email:'pfraze@foobar.com' }, headers:{ 'content-type':'application/json' }});
	// -> PATCH https://myhost.com/users/pfraze { email:'pfraze@foobar.com' }

	myhost.collection('users', { since:profile.id }).get(function(res2) {
		// -> GET https://myhost.com/users?since=123
		//...
	});
});
```

Notice that, within 

### Link.parseUri

[parseUri](http://stevenlevithan.com/demo/parseuri/js/) is written by Stephen Levithan. It breaks the input URL into its component parts:

```javascript
console.log(Link.parseUri('http://myserver.com/foobar?q=4').host); // => 'myserver.com'
```

### Link.UriTemplate

[**UriTemplate**](https://github.com/fxa/uritemplate-js) was written by Franz Antesberger. It generates URLs using URI Templates and some inputs:

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