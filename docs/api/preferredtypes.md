preferredTypes()
================

---

A utility function for content-negotiation, takes the accept header and a list of provided types, then provides a list of acceptable types ordered by the client's preference. Originally written by Federico Romero in the <a href="https://github.com/federomero/negotiator">Negotiator</a> library for node.js.

```javascript
var type = local.preferredType(req, ['application/json', 'text/html']);
if (type == 'application/json') { /* ... */ }
else if (type == 'text/html') { /* ... */ }
else { res.writeHead(406, 'not acceptable').end(); }
```

---

### local.preferredTypes(accept, provided)

 - `accept`: string|local.Request, given accept header or request object
 - `provided`: optional Array(string), allowed media types
 - returns Array(string), the acceptable types in order of client preference

---

### local.preferredType(accept, provided)

 - `accept`: string|local.Request, given accept header or request object
 - `provided`: optional Array(string), allowed media types
 - returns string, the acceptable type most preferable to the client.