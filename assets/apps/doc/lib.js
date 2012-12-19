app.onHttpRequest(function(request, response) {
	var makeNavLi = function(a, b, label) {
		return [
			(a == b) ? '<li class="active">' : '<li>',
			'<a href="httpl://lib.doc/', b, '">', label, '</a></li>'
		].join('');
	};
	var makeNav = function(tab) {
		return [
			'<ul class="nav nav-tabs">',
				makeNavLi(tab,'linkjs','LinkJS'),
				makeNavLi(tab,'common-client','CommonClient'),
				makeNavLi(tab,'myhouse','MyHouse (MyRules)'),
				makeNavLi(tab,'server-utils','Server Utils'),
				makeNavLi(tab,'rez-primitives','Resource Primitives'),
				makeNavLi(tab,'link-ap','LinkAP'),
			'</ul>'
		].join('');
	};
	if (request.path == '/linkjs') {
		response.writeHead(200, 'ok', { 'content-type':'text/html' });
		response.end(makeNav('linkjs') + '<p>An Ajax library that allows local functions to respond to HTTP requests.</p>');
	}
	else if (request.path == '/common-client') {
		response.writeHead(200, 'ok', { 'content-type':'text/html' });
		response.end(makeNav('common-client') + '<p>A generic-yet-powerful set of client-side behaviors.</p>');
	}
	else if (request.path == '/myhouse') {
		response.writeHead(200, 'ok', { 'content-type':'text/html' });
		response.end(makeNav('myhouse') + '<p>Create & control sandboxes in Web Workers from the parent document.</p>');
	}
	else if (request.path == '/server-utils') {
		response.writeHead(200, 'ok', { 'content-type':'text/html' });
		response.end(makeNav('server-utils') + '<p>Server utilities for user applications.</p>');
	}
	else if (request.path == '/rez-primitives') {
		response.writeHead(200, 'ok', { 'content-type':'text/html' });
		response.end(makeNav('rez-primitives') + '<p>RESTful resource utilities for user applications.</p>');
	}
	else if (request.path == '/link-ap') {
		response.writeHead(200, 'ok', { 'content-type':'text/html' });
		response.end(makeNav('link-ap') + '<p>Safely run user applications on the page using Web Workers.</p>');
	}
});
app.postMessage('loaded');