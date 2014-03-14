contentTypes
============

---

A registry of de/serializers for various mimetypes. Includes "application/json", "application/x-www-form-urlencoded", and "text/event-stream" by default.

```javascript
local.contentTypes.register('application/json',
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
local.contentTypes.serialize('application/json', { foo:'bar' });
// => '{ "foo":"bar" }'
local.contentTypes.deserialize('application/json', '{ "foo":"bar" }');
// => { foo:'bar' }
```

De/serializers are chosen by best match, according to the specificity of the provided mimetype. For instance, if 'application/foobar+json' is used, it will search for 'application/foobar+json', then 'application/json', then 'application'. If no match is found, the given parameter is returned as-is.

## local.contentTypes

### .register(mimetype, serializeFn, deserializeFn)

 - `mimetype`: required string
 - `serializeFn`: required function(obj)
 - `deserializeFn`: required function(str)

### .serialize(mimetype, object)

 - `mimetype`: required string
 - `object`: required object
 - returns string

### .deserialize(mimetype, string)

 - `mimetype`: required string
 - `string`: required string
 - returns object