// local.env.config.workerBootstrapUrl = '/lib/worker.js';

var lastRequestedHash = window.location.hash; // used to track if a hash-change should produce a request
var viewNav = document.getElementById('viewer-nav');
try {
viewNav.querySelector('a[href="'+(window.location.hash||'#readme.md')+'"]').parentNode.classList.add('active');
} catch (e) {}

// request wrapper
local.env.setDispatchWrapper(function(request, origin, dispatch) {
	// allow request
	return dispatch(request);
});

// response post-processor
local.env.setRegionPostProcessor(function(el) {
	if (el.id == 'viewer') {
		var urld = local.env.getClientRegion('viewer').context.urld;
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
		local.env.getClientRegion('viewer').dispatchRequest('httpl://markdown.util/'+window.location.hash.slice(1));
	}
};

// instantiate apps
local.env.addServer('markdown.util', new local.env.WorkerServer({
	src:'servers/worker/markdown.js',
	baseUrl:location.href.substring(0,location.href.split('#')[0].lastIndexOf("/")+1) + 'docs' // http://foobar.net/local/foo.html -> http://foobar.net/local/docs
}));

// load client regions
local.env.addClientRegion('viewer').dispatchRequest('httpl://markdown.util/'+(window.location.hash.slice(1)||'readme.md'));