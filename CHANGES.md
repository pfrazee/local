Changes
=======
0.6.0

2014/01/17 pfraze

 - Limited nav:|| URIs to 5 navigations to mitigate flooding attacks
 - Added request.header() and response.header() to simplify header access (was having issues of case-sensitivity)
 - Added function attributes to queryLink() queries


2014/01/16 pfraze

 - Added data scheme to isAbsUri
 - Moved the request.host attribute into request.headers in order to conform with HTTP/1.1.


2014/01/15 pfraze

 - Added Via header parsing
 - Added local.parseProxyUri and local.makeProxyUri


2014/01/14 pfraze

 - Added response.prototype.processHeaders


2014/01/11 pfraze

 - Added httpl://self to workers



0.5.2
=====

2013/12/13 pfraze

 - Added support for upper-cased method/body pairs in request options


2013/12/12 pfraze

 - Added support for upper-cased headers in request and response options


0.5.1
=====

2013/12/05 pfraze

 - Altered webrtc peer URI semantics to always refer to the 4th item as the 'sid' (instead of the ambiguous 'stream' or 'streamId')
 - Simplified gwr.io reltypes


2013/12/01 pfraze

 - Added timeout to requests


2013/11/26 pfraze

 - Added data-local-alias="a" to the request dom-events


2013/11/21 pfraze

 - Improved agent documentation
 - Added "close" message to HTTPL as a distinct event separate from "end". This enables the requester to close the stream after ending the request.


2013/11/19 pfraze

 - Added local.util.nextTick to optimize async


0.5.0
=====

2013/11/17 pfraze

 - Changed relay.getDomain() to .getAssignedDomain() for clarity
 - Added relay.getAssignedUrl()


2013/11/15 pfraze

 - Updated gwr.io protocols to no longer combine semantics (gwr.io/user item -> gwr.io/user/item)


2013/11/14 pfraze

 - Altered peer URI scheme to support ports in relay and application hosts
 - Added "host" attribute to requests given to local servers
 - Added non-standard "method" attr to requests extracted from anchor elements


2013/11/12 pfraze

 - Added opt.guestof to Relay requestAccessToken


2013/11/11 pfraze

 - Added Relay event "outOfStreams" to handle 420 response (no more allocatable streams)


2013/11/08 pfraze

 - Added local.patchXHR


0.4.0
=====

2013/11/04 pfraze

 - Standardized host_domain, host_user, host_relay, host_app, host_stream attribute extraction during link header processing.


2013/10/18 pfraze

 - Replaced worker main() pattern with local.worker.setServer() (was too flimsy)
 - Updated Relay to share server fn with all peers, and to allow server objects
 - Renamed
   - Server.handleLocalWebRequest -> Server.handleLocalRequest
   - Server.handleRemoteWebRequest -> Server.handleRemoteRequest


2013/10/16 pfraze

 - Renamed
   - Navigator -> Agent
   - Broadaster -> EventHost
   - registerServer -> addServer
   - unregisterServer -> removeServer
   - getServerRegistry -> getServers


2013/10/08 pfraze

 - Added optional BridgeServer HOL blocking for unordered channels, toggleable with useMessageReordering()
 - Updated RTCPeerServers to send HTTPL traffic over the Relay until the session is established
 - Changed the navigator `retry` param to `noretry`, making re-requests on failure the default


2013/10/07 pfraze

 - Renamed local.PeerWebRelay to local.Relay, local.joinPeerRelay to local.joinRelay
 - Added relay.navigator() and relay.registerLinks()


2013/10/05 pfraze

 - Added peer default stream (0) support (eg bob@foo.com!bar.com:0 == bob@foo.com!bar.com)


2013/09/27 pfraze

 - Added local.httpHeaders for standardized header de/serialization (similar to local.contentTypes)
 - Moved parsed headers into request/response.parsedHeaders, preserved serialized headers in .headers


2013/09/26 pfraze

 - Dropped queryLinks1 to avoid confusion


2013/09/25 pfraze

 - Moved everything from the local.web.* namespace to local.*


2013/09/23 pfraze

 - Added ping config to PeerWebRelay to keep streams alive


2013/09/22 pfraze

 - Added local.worker "connect" event for pages


2013/09/20 pfraze

 - Added local.logAllExceptions config flag
 - Added response.latency


2013/09/16 pfraze

 - Added navigator.rebase() and navigator.unresolve()


2013/09/09 pfraze

 - Added stream support to local.web.PeerWebRelay
 - Added 'listening' event and .startListening() to local.web.PeerWebRelay


2013/08/27 pfraze

 - Added local.web.BridgeServer
 - Added local.web.PeerWebRelay
 - Added local.joinPeerRelay
 - Added local.web.Server.getUrl()
 - Added {exclude:} option to local.web.Broadcaster.emit()
 - Added local.web.EventSource.getUrl()
 - Added local.util.mixinEventEmitter


2013/08/22 pfraze

 - Added local.* aliases (dispatch, subscribe, navigator, etc)
 - Added local.spawnAppServer, local.spawnWorkerServer
 - Added httpl://hosts service
 - Added Navigator.notify()
 - Added Request.finishStream()
 - Added self.config to workers
 - Removed local.client
   - Moved findParentNode, dispatchRequestEvent, trackFormSubmitter, extractRequest, extractRequestPayload, finishPayloadFileReads to local.util
   - Changed local.client.listen to local.bindRequestEvents
   - Changed local.client.unlisten to local.unbindRequestEvents
   - Removed regions and response handling utilities (they will be moved to a separate repo)
 - Removed local.env
   - Moved Server classes into local.web
   - Renamed Server.handleHttpRequest to handleLocalWebRequest


2013/08/09 pfraze

 - Removed the "proxy" URI scheme (supplanted by the "nav" scheme)
 - Updated local.env.addServer to accept functions as well as local.env.Server objects


2013/08/08 pfraze

 - Added support for the "nav" URI scheme
 - Refactored local.web.Navigator
   - Replaced `relation()` with `follow()`, which uses link queries in the form of `local.web.queryLink()`
   - Removed all `relation()` sugars (eg `collection()`, `item()`, etc)
   - Removed `get*` sugars and simplified existing dispatch sugars, as JSON is now pushed as the default
 - Added `local.web.isAbsUrl()` helper
 - Removed `local.web.lookupLink()` helper


2013/07/31 pfraze

 - Added local.web.joinRelPath
 - Added response header processing to change relative links (Link header) to absolute


2013/07/29 pfraze

 - Added support for the "proxy" URI scheme


2013/07/25 pfraze

 - Added `conn` parameter to web worker main function (signature is now `main(request, response, conn)`)


2013/07/15 pfraze

 - Added helpers: web.queryLink, web.queryLinks, web.queryLinks1
 - Added web.parseAcceptHeader, web.preferredTypes, web.preferredType
   - from https://github.com/federomero/negotiator
 - Improved web.parseLinkHeader (now handles non-quoted values and attributes without values)


2013/07/05 pfraze

 - Changed anchor element's generated request to have no method, so that decision can occur elsewhere


2013/07/01 pfraze

 - Updated http response header parsing to preserve case of header values (but still toLower() header names)
 - Added binary request support to HTTP/S


2013/06/29 pfraze

 - Changed local.client.renderResponse to wrap non-html content in <pre> tags.


2013/06/24 pfraze

 - Added env.RTCPeerServer (brought over from Grimwire repo)


2013/06/19 pfraze

 - Changed web.navigator (discovery protocol) to use the id attribute instead of title
 - Added setAuthHeader to web.navigator


2013/06/03 pfraze

 - Added support for SharedWorkers
   - Controlled with `shared` and `namespace` options to local.env.WorkerServer() and local.env.Worker()
 - local.web.Request & local.web.Response
   - Added automatic buffering with the body_ promise
 - local.util.EventEmitter
   - Added suspendEvents()/resumeEvents()
   - Dropped keepHistory()/loseHistory()


2013/06/01 pfraze

 - Added keepHistory() and loseHistory() to local.util.EventEmitter


2013/05/31 pfraze

 - Changed the param signature of the env dispatch wrapper to `(request, response, dispatch, origin)`
 - Refactored local.worker/local.env.Worker/local.env.WorkerServer API to use "exchange" protocol
   - Added local.worker.PageConnection to support multiple pages (for SharedWorker)
   - Improved logging from workers
   - Removed require() due to security issues
 - Renamed local.http to local.web
   - Added local.web.schemes to control dispatch() behaviors
   - Added local.web.setDispatchWrapper to allow local.env to wrap without monkey-patching
   - Added local.web.Request with support for request streaming
   - Added local.web.Response, dropped local.web.ClientResponse and local.web.ServerResponse
   - Altered local.web.subscribe to always use dispatch() (removing the need for special worker protocols)


2013/05/21 pfraze

 - Added `targetEl` parameter to `Region.prototype.dispatchRequest`
 - Updated URITemplates to latest
 - Added support for data-uris to local.http.dispatch()


0.3.1
=====

2013/05/19 pfraze

 - Moved worker.js and worker.min.js from /lib to / - simplifies paths
 - Commented out the CSP directives for all but Chrome, as they are breaking browsers which cant be upgraded (iOS)


0.3.0
=====

2013/05/15 pfraze

 - Changed html-deltas to use an ordered array structure


2013/05/08 pfraze

 - Added the "navigate" operation to html deltas


2013/05/07 pfraze

 - Decided against and removed local.http.reqheader & local.http.resheader


2013/05/06 pfraze

 - Added promise.always()
 - Added use of <form> `accept` attribute for data-subscribe behavior


2013/05/02 pfraze

 - Added link-lookup to navigator constructor
 - Added local.http.resheader() interface
 - Added cookie header support to req/resheader
 - Standardized request.path to always give '/' for root resources and never include trailing slashes
 - Added enumeration of inputs in the request query to data-subscribe event GET requests
 - Added 'remove' and 'setValue' html-delta operations


2013/04/30 pfraze

 - Changed WorkerServer config to use `src` param, which may take a data-uri
 - Updated `data-subscribe` to optionally take a second URL specifying where to issue the GET to
 - Added local.http.reqheader() interface with 'link' header support
 - Enforced all-caps request.method in local.http.dispatch()


2013/04/29 pfraze

 - Added file-reading for form submits with input type=file (single and multi)


2013/04/26 pfraze

 - Moved region post-processing to the render fn, to ensure that post-processing only occurs on new HTML


2013/04/24 pfraze

 - Deprecated local.http.ext.*
   - Moved navigator into local.http.*
   - Moved Broadcaster into local.http.* in events.js
   - Moved Responder.pipe() and Headerer.serialize into local.http.* in helpers.js
   - Deprecrated Responder, Headerer and Router
 - Deprecated servers/env/static.js (no longer in us)


2013/04/23 pfraze

 - Added require() method to workers


2013/04/22 pfraze

 - Restructured namespaces to all live under `local`
   - Promises are now `local.promise.*`
   - Workers' `localApp` is now `local.worker.*`
   - Link is now `local.http.*`
   - Environment and MyHouse are now `local.env.*`
   - CommonClient and Environment.ClientRegion are now `local.client.*` and `local.client.Region`
   - Link.EventEmitter is now in `local.util.*`
 - Removed `local.http.ResponseError`
   - Rejected responses are now rejected with the response objects directly (not wrapped in the error)
 - Renamed Local's custom worker `postMessage` and `onMessage` functions to `postNamedMessage` and `onNamedMessage`
 - Changed workers to define `main()` to set the entry-point


2013/04/07 pfraze

 - Brought promises under `Local` namespace and made conformant with Promises/A+


2013/03/28 pfraze

- Restructured in clean repository with no submodules.
    This was done 1) to shed a .git that had balooned from an asset commit in the past
    2) to simplify the structure of the project
- Reworked Worker servers to behave similarly to Environment servers
- Removed 'loaded' message in workers in favor of 'importScripts' response