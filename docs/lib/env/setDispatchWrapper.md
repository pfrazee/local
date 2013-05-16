```javascript
local.env.setDispatchWrapper(function(request, origin, dispatch) {
  return dispatch(request);
});
```

<br />
#### local.env.setDispatchWrapper( <small>wrapperFn</small> ) <small>=> undefined</small>

Sets an environment function to monitor page traffic.