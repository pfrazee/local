httpHeaders
===========

---

A registry of de/serializers for various headers. Includes "link" and "accept" by default.

```javascript
local.httpHeaders.register('link',
  function (obj) { /* ... */ },
  function (str) { /* ... */ }
);
local.httpHeaders.serialize('link', { href: 'httpl://foo', rel: 'service' });
// => '<httpl://foo>; rel="service"'
local.httpHeaders.deserialize('link', '<httpl://foo>; rel="service"');
// => { href: 'httpl://foo', rel: 'service' }
```

Received requests and responses have their headers automatically parsed by the available deserializers and stored in `parsedHeaders`. The reverse is true of sent requests/responses.

## local.httpHeaders

### .register(header, serializeFn, deserializeFn)

 - `header`: required string
 - `serializeFn`: required function(obj)
 - `deserializeFn`: required function(str)

### .serialize(header, object)

 - `header`: required string
 - `object`: required object
 - returns string

### .deserialize(header, string)

 - `header`: required string
 - `string`: required string
 - returns object