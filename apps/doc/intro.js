importScripts('linkjs-ext/responder.js');
importScripts('linkjs-ext/router.js');
app.onHttpRequest(function(request, response) {
	Link.router(request).mpa('get', '/', /html/, function() {
		Link.responder(response).ok('html').end([
			'<h1>Local <small>0.2.0 unstable</small></h1>',
			'<p>Safely run user applications on the page using Web Workers.</p>',
			'<h4>Introduction</h4>',
			'<p>The Web Workers API runs scripts in threads which can only reach the document via messaging. This provides enough safety to run user applications on the page, but makes it hard for those apps to render to the document. To overcome this limitation, LinkAP emulates HTTP over the Workers\'s messaging system, allowing applications to serve HTML as if they were remote.</p>',
			'<p>By way of example, all of the content on this page is served by embedded application servers.</p>',
			'<blockquote><small>Click the script icons on the top right of an app to view and modify its source.</small></blockquote>'
		].join(''));
	}).error(response);
});
app.postMessage('loaded');