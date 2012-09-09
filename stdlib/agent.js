// Agent
// =====
// standard agent object, should be included by all worker programs

importScripts('/stdlib/globals.js');
importScripts('/stdlib/msgevents.js');
importScripts('/stdlib/util.js');
importScripts('/stdlib/promise.js');
importScripts('/stdlib/contenttypes.js');
importScripts('/stdlib/httprouter.js');

if (typeof Agent == 'undefined') {
	(function() {
		globals.Agent = {
			io:new HttpRouter()
		};

		addEventMsgListener('http:request', function(e) {
			Agent.io.dispatch(e.request).then(function(response) {
				postEventMsg('http:response', { mid:e.mid, response:response });
			});
		});

	})();
}