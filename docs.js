// helpers
function logError(err) {
	if (err.request) { console.log(err.message, err.request); }
	else { console.log(err.message);}
	return err;
}

// request wrapper
var currentHash = window.location.hash;
Environment.request = function(origin, request) {

	var urld = Link.parseUri(request);
	var newHash = '#' + urld.path.slice(1);
	if (urld.host == 'markdown.util' && currentHash != newHash) {
		console.log(newHash);
		currentHash = newHash;
		window.location.hash = newHash;
	}

	// allow request
	var response = Link.request(request);
	response.except(logError);
	return response;
};

Environment.postProcessRegion = function(el) {
	Prism.highlightAll();
};

// setup nav
var viewNav = document.getElementById('viewer-nav');
window.onhashchange = function() {
	var active = viewNav.querySelector('.active');
	active && active.classList.remove('active');
	viewNav.querySelector('a[href="'+window.location.hash+'"]').parentNode.classList.add('active');
	// only issue a request if the request hasnt already been issued
	if (currentHash != window.location.hash) {
		Environment.getClientRegion('viewer').request('httpl://markdown.util/'+window.location.hash.slice(1));
		currentHash = window.location.hash;
	}
};

// instantiate apps
Environment.addServer('markdown.util', new Environment.WorkerServer({
	scriptUrl:'/apps/util/markdown.js',
	baseUrl:location.href.substring(0,location.href.split('#')[0].lastIndexOf("/")+1) + 'docs' // http://pfraze.net/local/docs.html -> http://pfraze.net/local/docs
}));

// load client regions
Environment.addClientRegion('viewer').request('httpl://markdown.util/'+(window.location.hash.slice(1)||'readme.md'));
viewNav.querySelector('a[href="'+(window.location.hash||'#readme.md')+'"]').parentNode.classList.add('active');