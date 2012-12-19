app.onHttpRequest(function(request, response) {
	response.writeHead(200, 'ok', { 'content-type':'text/html' });
	response.end('<h1>LinkAP v0.2.0 <small>unstable</small></h1>' +
		'<p>Safely run user applications on the page using Web Workers.</p>' +
		'<h4>Introduction</h4>' +
		'<p>The Web Workers API runs scripts in threads which are only exposed to the document through messages. This creates a safe environment to run untrusted code, but also limits the possible interactions between the thread and the document. To overcome this limitation, LinkAP applications serve HTML over HTTP-Local (an in-document emulation of TCP HTTP) effectively embedding web-servers in the document. The environment then builds a standard set of client behaviors to issue requests to the user apps and render the results within sandboxed regions of the DOM.</p>' +
		'<p>All of the content on this page is served by embedded application servers.</p>' +
		'<br/>'
	);
});
app.postMessage('loaded');