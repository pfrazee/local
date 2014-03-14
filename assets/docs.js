var viewer = document.getElementById('viewer');
var viewNav = document.getElementById('viewer-nav');

// Load the markdown conversion worker
local.spawnWorkerServer('./assets/mdworker.js', { domain: 'mdworker.js' });

function getContent() {
	var path = window.location.hash.slice(1) || 'README.md';
	var baseUrl = (location.origin||(location.protocol+'//'+location.host));
	var url = local.joinRelPath(baseUrl, path);

	// Update nav higlight
	var active = viewNav.querySelector('.active');
	if (active) active.classList.remove('active');
	viewNav.querySelector('a[href="#'+path+'"]').parentNode.classList.add('active');

	// Get markdown
	local.GET(url)
		.then(function(res) {
			// Convert to HTML
			return local.POST(res.body, 'httpl://mdworker.js');
		})
		.then(function (res) {
			// Render
			viewer.innerHTML = res.body;
			window.scrollTo(0,0);
			Prism.highlightAll();
		})
		.fail(function (res) {
			console.error('Failed loading '+path, res);
			viewer.innerHTML = '<h2>'+res.status+' '+res.reason+'</h2><strong>There was an error loading the document.</strong><br/>Sorry for the inconvenience! Please let me know at <a href="//github.com/grimwire/local/issues">github.com/grimwire/local/issues</a>.';
		});
}
window.onhashchange = getContent;
getContent();