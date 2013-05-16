```javascript
function getUser(username) {
  return local.http.navigator('httpl://myhost.com')
    .collection('users')
    .item(username)
    .getJson()
}
```

<br/>
The navigator is a programmatic HTTP agent which follows links provided in response headers. Every navigation is lazy, waiting until a request is dispatched before resolving the relations to URLs.

Links are resolved by issuing HEAD requests, then searching the returned Link headers.

<br/>
### local.http.Navigator

The navigator prototype. Use `local.http.navigator()` to instantiate.

<br/>
#### local.http.navigator( <small>url</small> ) <small>=> local.http.Navigator</small>
#### local.http.navigator( <small>links, rel, [title]</small> ) <small>=> local.http.Navigator</small>

Creates a new navigator.

 - If `url` is specified, uses that as the starting point.
 - If a `links` Array is given, uses `rel` (and, optionally, `title`) to search for the initial url.

<br/>
#### local.http.Navigator#relation( <small>rel, [title], [params]</small> ) <small>=> local.http.Navigator</small>

Creates a new `local.http.Navigator` with an unresolved relative context. `rel` is a string which maps to the desired link's "rel" attribute, as is the (optional) `title`. `params` is an optional object of k/vs to use with the URI Template.

<br/>
#### local.http.Navigator#dispatch( <small>request</small> ) <small>=> local.promise(local.http.ClientResponse)</small>

Resolves the navigator and its ancestors to absolute contexts, then dispatches the specified request to the resolved URL.

<br/>
#### local.http.Navigator#resolve( <small>[options]</small> ) <small>=> local.promise(String)</small>

Resolves the navigator's URL, reporting failure if a link or resource is unfound.

`options` is optional, and may include:

 - `retry`: boolean, should the resolve be tried if it previously failed?
 - `nohead`: boolean, should we issue a HEAD request once we have a URL? This is used to get the current context's links, which might not be necessary if you're planning to issue a non-HEAD request using the navigator.

<br/>
#### local.http.Navigator#dispatch( <small>request</small> ) <small>=> local.promise(local.http.EventStream)</small>

Resolves the navigator and its ancestors to absolute contexts, then calls `local.http.subscribe()` on the resolved URL.

<br/>
The following functions are sugars for the `relation()` function:

#### local.http.Navigator#alternate( <small>[title], [options]</small> ) <small>=> local.http.Navigator</small>
#### local.http.Navigator#author( <small>[title], [options]</small> ) <small>=> local.http.Navigator</small>
#### local.http.Navigator#collection( <small>[title], [options]</small> ) <small>=> local.http.Navigator</small>
#### local.http.Navigator#current( <small>[title], [options]</small> ) <small>=> local.http.Navigator</small>
#### local.http.Navigator#describedby( <small>[title], [options]</small> ) <small>=> local.http.Navigator</small>
#### local.http.Navigator#first( <small>[title], [options]</small> ) <small>=> local.http.Navigator</small>
#### local.http.Navigator#index( <small>[title], [options]</small> ) <small>=> local.http.Navigator</small>
#### local.http.Navigator#item( <small>[title], [options]</small> ) <small>=> local.http.Navigator</small>
#### local.http.Navigator#last( <small>[title], [options]</small> ) <small>=> local.http.Navigator</small>
#### local.http.Navigator#latest_version( <small>[title], [options]</small> ) <small>=> local.http.Navigator</small>
#### local.http.Navigator#monitor( <small>[title], [options]</small> ) <small>=> local.http.Navigator</small>
#### local.http.Navigator#monitor_group( <small>[title], [options]</small> ) <small>=> local.http.Navigator</small>
#### local.http.Navigator#next( <small>[title], [options]</small> ) <small>=> local.http.Navigator</small>
#### local.http.Navigator#next_archive( <small>[title], [options]</small> ) <small>=> local.http.Navigator</small>
#### local.http.Navigator#payment( <small>[title], [options]</small> ) <small>=> local.http.Navigator</small>
#### local.http.Navigator#predecessor_version( <small>[title], [options]</small> ) <small>=> local.http.Navigator</small>
#### local.http.Navigator#prev( <small>[title], [options]</small> ) <small>=> local.http.Navigator</small>
#### local.http.Navigator#prev_archive( <small>[title], [options]</small> ) <small>=> local.http.Navigator</small>
#### local.http.Navigator#related( <small>[title], [options]</small> ) <small>=> local.http.Navigator</small>
#### local.http.Navigator#replies( <small>[title], [options]</small> ) <small>=> local.http.Navigator</small>
#### local.http.Navigator#search( <small>[title], [options]</small> ) <small>=> local.http.Navigator</small>
#### local.http.Navigator#self( <small>[title], [options]</small> ) <small>=> local.http.Navigator</small>
#### local.http.Navigator#service( <small>[title], [options]</small> ) <small>=> local.http.Navigator</small>
#### local.http.Navigator#successor_version( <small>[title], [options]</small> ) <small>=> local.http.Navigator</small>
#### local.http.Navigator#up( <small>[title], [options]</small> ) <small>=> local.http.Navigator</small>
#### local.http.Navigator#version_history( <small>[title], [options]</small> ) <small>=> local.http.Navigator</small>
#### local.http.Navigator#via( <small>[title], [options]</small> ) <small>=> local.http.Navigator</small>
#### local.http.Navigator#working_copy( <small>[title], [options]</small> ) <small>=> local.http.Navigator</small>
#### local.http.Navigator#working_copy_of( <small>[title], [options]</small> ) <small>=> local.http.Navigator</small>

<br/>
The following functions are sugars for the `dispatch()` function:

#### local.http.Navigator#head( <small>[body], [type], [headers], [options]</small> ) <small>=> local.promise(local.http.ClientResponse)</small>
#### local.http.Navigator#get( <small>type, [headers], [options]</small> ) <small>=> local.promise(local.http.ClientResponse)</small>
#### local.http.Navigator#getJson( <small>[headers], [options]</small> ) <small>=> local.promise(local.http.ClientResponse)</small>
#### local.http.Navigator#getHtml( <small>[headers], [options]</small> ) <small>=> local.promise(local.http.ClientResponse)</small>
#### local.http.Navigator#getXml( <small>[headers], [options]</small> ) <small>=> local.promise(local.http.ClientResponse)</small>
#### local.http.Navigator#getEvents( <small>[headers], [options]</small> ) <small>=> local.promise(local.http.ClientResponse)</small>
#### local.http.Navigator#getPlain( <small>[headers], [options]</small> ) <small>=> local.promise(local.http.ClientResponse)</small>
#### local.http.Navigator#getText( <small>[headers], [options]</small> ) <small>=> local.promise(local.http.ClientResponse)</small>
#### local.http.Navigator#post( <small>[body], [type], [headers], [options]</small> ) <small>=> local.promise(local.http.ClientResponse)</small>
#### local.http.Navigator#put( <small>[body], [type], [headers], [options]</small> ) <small>=> local.promise(local.http.ClientResponse)</small>
#### local.http.Navigator#patch( <small>[body], [type], [headers], [options]</small> ) <small>=> local.promise(local.http.ClientResponse)</small>
#### local.http.Navigator#delete( <small>[body], [type], [headers]</small> ) <small>=> local.promise(local.http.ClientResponse)</small>