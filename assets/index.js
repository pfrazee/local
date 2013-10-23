var viewer = document.getElementById('viewer');
var viewNav = document.getElementById('viewer-nav');

// Load the markdown conversion worker
local.spawnWorkerServer('assets/mdworker.js', { baseUrl: location.origin+location.pathname.slice(0,-1) });

function getContent() {
	var path = window.location.hash.slice(1) || 'README.md';

	// Update nav higlight
	var active = viewNav.querySelector('.active');
	if (active) active.classList.remove('active');
	viewNav.querySelector('a[href="#'+path+'"]').parentNode.classList.add('active');

	// Send request
	local.dispatch('httpl://mdworker.js/'+path).then(
		function (res) {
			viewer.innerHTML = res.body;
			Prism.highlightAll();
		},
		function (res) {
			console.error('Failed loading '+path, res);
			viewer.innerHTML = '<h2>'+res.status+' '+res.reason+'</h2><strong>There was an error loading the document.</strong><br/>Sorry for the inconvenience! Please let me know at <a href="//github.com/grimwire/local/issues">github.com/grimwire/local/issues</a>.';
		}
	);
}
window.onhashchange = getContent;
getContent();