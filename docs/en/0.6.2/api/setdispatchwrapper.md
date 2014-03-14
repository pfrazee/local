setDispatchWrapper()
====================

---

An optional middleware that is injected between `dispatch()` and delivery of the request.

```javascript
local.setDispatchWrapper(function(request, response, dispatch) {
	dispatch(request, response).always(console.log.bind(console, request));
});
```

It can be used for setting global policies such as:

 - Logging
 - Caching strategies
 - Traffic rerouting
 - Permissioning
 - Header behaviors
 - Formatting and sanitizing

Make sure that all requests eventually receive a response, even if the request is not passed on to the given dispatch function.

### local.setDispatchWrapper(wrapperFn)

 - `wrapperFn`: required function(request, response, dispatch)