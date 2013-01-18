Example: docs.html
==================

pfraze 2013


## Overview

Docs.html is a complete markdown-viewer application. It uses a markdown-to-HTML proxy (apps/util/markdown.js) to browse the markdown files hosted on the remote server (under docs/).


## docs.js

```javascript
// helpers
function logError(err) {
	if (err.request) { console.log(err.message, err.request); }
	else { console.log(err.message);}
	return err;
}

// request wrapper
var currentHash = window.location.hash;
Environment.setDispatchHandler(function(origin, request) {

	var urld = Link.parseUri(request);
	var newHash = '#' + urld.path.slice(1);
	if (urld.host == 'markdown.util' && currentHash != newHash) {
		currentHash = newHash;
		window.location.hash = newHash;
	}

	// allow request
	var response = Link.dispatch(request);
	response.except(logError);
	return response;
});

Environment.setRegionPostProcessor(function(el) {
	Prism.highlightAll();
});

// setup nav
var viewNav = document.getElementById('viewer-nav');
window.onhashchange = function() {
	var active = viewNav.querySelector('.active');
	active && active.classList.remove('active');
	viewNav.querySelector('a[href="'+window.location.hash+'"]').parentNode.classList.add('active');
	window.scroll(0,0);
	// only issue a request if the request hasnt already been issued
	if (currentHash != window.location.hash) {
		Environment.getClientRegion('viewer').dispatchRequest('httpl://markdown.util/'+window.location.hash.slice(1));
		currentHash = window.location.hash;
	}
};

// instantiate apps
Environment.addServer('markdown.util', new Environment.WorkerServer({
	scriptUrl:'/apps/util/markdown.js',
	baseUrl:location.href.substring(0,location.href.split('#')[0].lastIndexOf("/")+1) + 'docs' // http://pfraze.net/local/docs.html -> http://pfraze.net/local/docs
}));

// load client regions
Environment.addClientRegion('viewer').dispatchRequest('httpl://markdown.util/'+(window.location.hash.slice(1)||'readme.md'));
viewNav.querySelector('a[href="'+(window.location.hash||'#readme.md')+'"]').parentNode.classList.add('active');
```