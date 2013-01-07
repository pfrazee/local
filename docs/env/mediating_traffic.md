Mediating Traffic
=================

2013 pfraze


[...] mostly accomplished by the 'request wrapper', which is minimally defined as follows:

```javascript
Environment.request = function(origin, request) {
	// pass the request to Link for fulfillment
	return Link.request(request);
};
```


## Connectivity, Permissions, and Credentials

[...]

```javascript
Environment.request = function(origin, request) {
	// can the origin make this request?
	if (!requestAllowed(origin, request)) {
		return new Link.ResponseError({ status:403, reason:'forbidden' });
	}

	//...

	// pass the request to Link for fulfillment
	return Link.request(request);
};
```

[...]

```javascript
function requestAllowed(origin, request) {
	if (origin instanceof CustomEnvironmentServer) {
		return true; // allow my environment server to make any request
	}
	var urld = Link.parseUrl(request.url);
	if (origin instanceof Environment.WorkerServer) {
		if (urld.protocol == 'httpl') {
			return true; // only allow local requests to user applications
		}
	}
	return false;
}
```

[...]

never allow credentials to leak

```javascript
Environment.request = function(origin, request) {
	
	//...

	// add credentials to sessions
	if (origin.hasSession(request)) {
		Link.headers(request.headers).addAuth(origin.getSession(request));
	}

	// ...

};
```