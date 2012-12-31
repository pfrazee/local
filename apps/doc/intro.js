importScripts('/lib/linkjs-ext/responder.js');
importScripts('/lib/linkjs-ext/router.js');
app.onHttpRequest(function(request, response) {
	Link.router(request).mpa('get', '/', /html/, function() {
		Link.responder(response).ok('html').end(
			'<h1>LAP <small>0.2.0 unstable</small></h1>' +
			'<p>Safely run user applications on the page using Web Workers.</p>' +
			'<h4>Introduction</h4>' +
			'<p>The Web Workers API runs scripts in threads which can only reach the document via messaging. This provides enough safety to run user applications on the page, but also stops the apps from updating the document. To overcome this limitation, LinkAP emulates HTTP over the Workers\'s messaging system, allowing applications to serve HTML as if they were remote. The environment then issues requests to the user apps and renders the results within sandboxed regions of the DOM.</p>' +
			'<p>By way of example, all of the content on this page is served by embedded application servers.</p>' +
			'<br/>'
		);
	}).error(response);
});
app.postMessage('loaded');