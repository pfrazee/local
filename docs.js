// helpers
function logError(err) {
	if (err.request) { console.log(err.message, err.request); }
	else { console.log(err.message);}
	return err;
}

// request wrapper
var lastRequestedHash = window.location.hash; // used to track if a hash-change should produce a request
Environment.setDispatchHandler(function(origin, request) {

	var urld = Link.parseUri(request);
	var newHash = '#' + urld.path.slice(1);
	lastRequestedHash = newHash;
	if (urld.host == 'markdown.util' && window.location.hash != newHash) {
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
viewNav.addEventListener('click', function(e) {
	if (e.target.tagName == 'A') {
		var path = e.target.getAttribute('href').slice(1);
		Environment.getClientRegion('viewer').dispatchRequest('httpl://markdown.util/'+path);
	}
});
window.onhashchange = function() {
	var active = viewNav.querySelector('.active');
	active && active.classList.remove('active');
	viewNav.querySelector('a[href="'+window.location.hash+'"]').parentNode.classList.add('active');
	if (lastRequestedHash != window.location.hash) {
		// we need to issue the request - a link didnt already do it for us
		Environment.getClientRegion('viewer').dispatchRequest('httpl://markdown.util/'+window.location.hash.slice(1));
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