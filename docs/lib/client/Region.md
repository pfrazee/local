```javascript
var region = local.env.addClientRegion('viewer');
region.dispatchRequest('httpl://markdown.util/readme.md');
```

<br />
### local.client.Region

Prototype for the region object. Instantiate with `local.env.addClientRegion()`. Keeps track of a current context (the URL of the most recent request) as well as various other pieces of state.

<br/>
#### local.client.Region#dispatchRequest( <small>request</small> ) <small>=> undefined</small>

Generates a "request" event on the region's root element using the `request` parameters provided. The `request` may optionally be a URL string, in which case the method will default to GET and the accept header will default to text/html.

<br/>
#### local.client.Region#terminate() <small>=> undefined</small>

Detaches the region's listeners from the root element.

<br/>
#### local.client.Region#__prepareRequest( <small>request</small> ) <small>=> undefined</small>

Internal, massages the request's parameters using the region's context.

<br/>
#### local.client.Region#__handleResponse( <small>originalEvent, request, response</small> ) <small>=> undefined</small>

Internal, reacts to a response (usually by updating the document).

<br/>
#### local.client.Region#__updateContext( <small>request, response</small> ) <small>=> undefined</small>

Internal, updates the region's context according to the response.