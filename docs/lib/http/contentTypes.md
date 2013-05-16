```javascript
local.http.contentTypes.register('application/json',
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
local.http.contentTypes.serialize({ foo:'bar' }, 'application/json');
// => '{ "foo":"bar" }'
local.http.contentTypes.deserialize('{ "foo":"bar" }', 'application/json');
// => { foo:'bar' }
```

Remote requests must have their payloads serialized and their responses deserialzed. `local.http.contentTypes` provides a registry of de/serializers for various mimetypes. Json and "application/x-www-form-urlencoded" are provided by default.

De/serializers are chosen by best match, according to the specificity of the provided mimetype. For instance, if 'application/foobar+json' is used, it will search for 'application/foobar+json', then 'application/json', then 'application'. If no match is found, the given parameter is returned as-is.


<br/>
#### local.http.contentTypes.register( <small>mimetype, serializeFn, deserializeFn</small> ) <small>=> undefined</small>

<br/>
### local.http.contentTypes.serialize( <small>object, mimetype</small> ) <small>=> string</small>

If unable to serialize (mimetype serializer not found, `object` is not an object, etc), `object` is returned as-is.

<br/>
### local.http.contentTypes.deserialize( <small>string, mimetype</small> ) <small>=> object</small>

If unable to deserialize (mimetype deserializer not found, `string` is not an string, etc), `string` is returned as-is.