Changes
=======

2013/04/30 pfraze

 - Changed WorkerServer config to use `src` param, which may take a data-uri
 - Updated `data-subscribe` to optionally take a second URL specifying where to issue the GET to
 - Added local.http.reqheader() and local.http.reqapi() interfaces
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