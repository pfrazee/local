Link.Navigator
==============

pfraze 2013


## Overview

Navigator is an HTTP agent for consuming services. It provides functions to navigate link headers and to send requests.

The navigator is built on two functions: `relation()` and `dispatch()`. All other functions are sugars of these two.

Link headers are followed by the `relation()` function, which produces a new `Navigator` with the new context. It doesn't remotely verify the location yet, however. Instead, it waits until a request is issued, then resolves the back-log of relations with HEAD requests.

```javascript
var myhost = new Navigator('https://myhost.com');
var me = myhost.collection('users').item('pfraze');

me.get()
	// -> HEAD https://myhost.com
	// -> HEAD https://myhost.com/users
	// -> GET  https://myhost.com/users/pfraze
	.then(function(res) {

		me.patch({ body:{ email:'pfraze@foobar.com' }, headers:{ 'content-type':'application/json' }});
		// -> PATCH https://myhost.com/users/pfraze { email:'pfraze@foobar.com' }

		myhost.collection('users', { since:profile.id })
			.get()
	    	.then(function(res2) {
				// -> GET https://myhost.com/users?since=123
				//...
			});
	});
```

The Link headers are expected to include, minimally, the 'href' and 'rel' attributes. The `href` may use <a target="_top" href="http://tools.ietf.org/html/rfc6570">URI Templates</a>.



## API

### Link.navigator( <small>url</small> ) <small>=> Navigator</small>

### relation( <small>rel, param, [extra]</small> ) <small>=> Navigator(ClientResponse)</small>

Creates a new Navigator object which is relative to the caller by following the Link header of the caller's context. For instance, if a navigator's links include a 'collection' relation with the title of 'friends', then it could be followed with `myNav.relation('collection', 'friends')`.

Parameter 1 specifies which link to use by matching the `rel` attribute. Parameter 2 is matched against the `title` attribute, if one is present. If parameter 2 does not match, then `relation()` defaults to the last match.

If the link's `href` value is a URI Template, `param` and `extra` will be used to build the URI. A token named with the value of `rel` is replaced with the value `param`. For example:

```javascript
var myhost = Link.navigator('https://myhost.com');

var users = myservice.relation('collection', 'users');
// if: Link=[{ rel:'collection', href:'/{collection}' }]
// then: users='https://myhost.com/users'

var me = users.relation('item', 'pfraze', { foo:'bar' });
// if: Link=[{ rel:'item', href:'/users/{item}{?foo}' }, { rel:'service', href:'/' }]
// then: me='https://myhost.com/users?foo=bar'
```


### dispatch( <small>requestObj</small> ) <small>=> Local.Promise(ClientResponse)</small>

The `dispatch()` function issues a request from the current context.


## Sugars

The `dispatch()` and `relation()` functions have sugars for, respectively, the dispatch methods and relation types. They can be used to reduce the number of parameters given. They are:

```javascript
// dispatch sugars
head([body], [bodyContentType], [headers], [options])
post([body], [bodyContentType], [headers], [options])
put([body], [bodyContentType], [headers], [options])
patch([body], [bodyContentType], [headers], [options])
delete([body], [bodyContentType], [headers], [options])

// GET dispatch sugars
get([acceptType], [headers], [options])
getJson([headers], [options])
getHtml([headers], [options])
getXml([headers], [options])
getEvents([headers], [options])
getEventstream([headers], [options])
getPlain([headers], [options])
getText([headers], [options])

// relation sugars
// http://www.iana.org/assignments/link-relations/link-relations.xml
alternate(param, [extra])
author(param, [extra])
collection(param, [extra])
current(param, [extra])
describedby(param, [extra])
first(param, [extra])
index(param, [extra])
item(param, [extra])
last(param, [extra])
latest_version(param, [extra])
monitor(param, [extra])
monitor_group(param, [extra])
next(param, [extra])
next_archive(param, [extra])
payment(param, [extra])
predecessor_version(param, [extra])
prev(param, [extra])
prev_archive(param, [extra])
related(param, [extra])
replies(param, [extra])
search(param, [extra])
self(param, [extra])
service(param, [extra])
successor_version(param, [extra])
up(param, [extra])
version_history(param, [extra])
via(param, [extra])
working_copy(param, [extra])
working_copy_of(param, [extra])
```