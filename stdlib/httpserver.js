// HTTP Server
// ===========
// convenience API for handling HTTP requests

importScripts('/stdlib/msgevents.js');
importScripts('/assets/js/link.js');

if (typeof HttpServer == 'undefined') {
	var HttpServer = (function() {
		var HttpServer = new Link.Structure();

		addEventMsgListener('http:request', function(e) {
			HttpServer.dispatch(e.request).then(function(response) {
				postEventMsg('http:response', { mid:e.mid, response:response });
			});
		});

		return HttpServer;
	})();
}