importScripts('/lib/linkjs-ext/responder.js');
importScripts('/lib/linkjs-ext/router.js');

// html builders
var makeNavLi = function(a, b, label) {
	return [
		(a == b) ? '<li class="active">' : '<li>',
		'<a href="httpl://'+app.config.domain, '/', b, '">', label, '</a></li>'
	].join('');
};
var makeNav = function(tab) {
	return [
		'<ul class="nav nav-pills">',
			makeNavLi(tab,'linkjs','LinkJS'),
			makeNavLi(tab,'apps','Applications'),
			makeNavLi(tab,'platform','Platform'),
			makeNavLi(tab,'common-client','CommonClient'),
			makeNavLi(tab,'myhouse','MyHouse (MyRules)'),
		'</ul>'
	].join('');
};

// documentation resources
var htmlResources = {
	'/linkjs'        : makeNav('linkjs') + '<p>An Ajax library that allows local functions to respond to HTTP requests.</p>',
	'/apps'          : makeNav('apps') + '<p>Tools for building user applications.</p>',
	'/platform'      : makeNav('platform') + '<p>How it all comes together.</p>',
	'/common-client' : makeNav('common-client') + '<p>Standard client behaviors.</p>',
	'/myhouse'       : makeNav('myhouse') + '<p>Create & control sandboxes in Web Workers from the parent document.</p>'
};

// server request handler
app.onHttpRequest(function(request, response) {
	var router = Link.router(request);
	router.m('GET', function() {
		// add htmlResources responders
		for (var path in htmlResources) { router.p(path, function() { Link.responder(response).ok('html').end(htmlResources[path]); }); }
		router.p('/', function() { Link.responder(response).ok('html').end(htmlResources['/linkjs']); });
		router.error(response);
	});
	router.error(response);
});
app.postMessage('loaded');