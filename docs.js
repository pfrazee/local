var lastRequestedHash = window.location.hash; // used to track if a hash-change should produce a request
var viewNav = document.getElementById('viewer-nav');
viewNav.querySelector('a[href="'+(window.location.hash||'#readme.md')+'"]').parentNode.classList.add('active');

// request wrapper
Environment.setDispatchWrapper(function(request, origin, dispatch) {
	// allow request
	var response = dispatch(request);
	response.fail(console.log.bind(console));
	return response;
});

// response post-processor
Environment.setRegionPostProcessor(function(el) {
	if (el.id == 'viewer') {
		var urld = Environment.getClientRegion('viewer').context.urld;
		window.location.hash = lastRequestedHash = '#' + urld.path.slice(1);
	}
	Prism.highlightAll();
});

// setup hash navigation
window.onhashchange = function() {
	// update nav higlight
	var active = viewNav.querySelector('.active');
	if (active) active.classList.remove('active');
	viewNav.querySelector('a[href="'+window.location.hash+'"]').parentNode.classList.add('active');

	if (lastRequestedHash != window.location.hash) {
		// we need to issue the request - a link didnt already do it for us
		Environment.getClientRegion('viewer').dispatchRequest('httpl://markdown.util/'+window.location.hash.slice(1));
	}
};

// instantiate apps
Environment.addServer('markdown.util', new Environment.WorkerServer({
	scriptUrl:'../servers/worker/markdown.js',
	baseUrl:location.href.substring(0,location.href.split('#')[0].lastIndexOf("/")+1) + 'docs' // http://pfraze.net/local/docs.html -> http://pfraze.net/local/docs
}));

// load client regions
Environment.addClientRegion('viewer').dispatchRequest('httpl://markdown.util/'+(window.location.hash.slice(1)||'readme.md'));