Link.contentTypes
=================

pfraze 2013


## Overview

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


## API

### Link.contentTypes.register( <small>mimetype, serializeFn, deserializeFn</small> ) <small>=> undefined</small>

### Link.contentTypes.serialize( <small>object, mimetype</small> ) <small>=> string</small>

If unable to serialize (mimetype serializer not found, `object` is not an object, etc), `object` is returned as-is.

### Link.contentTypes.deserialize( <small>string, mimetype</small> ) <small>=> object</small>

If unable to deserialize (mimetype deserializer not found, `string` is not an string, etc), `string` is returned as-is.