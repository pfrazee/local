Changes
=======
0.3.2

2013/05/21 pfraze

 - Added `targetEl` parameter to `Region.prototype.dispatchRequest`
 - Updated URITemplates to latest


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