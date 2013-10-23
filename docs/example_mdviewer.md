Example: Markdown Viewer
========================

---

The documentation site of Local.js is a Markdown viewer built using <a href="https://github.com/chjj/marked">Marked, by Christopher Jeffrey</a>, and <a href="https://github.com/LeaVerou/prism">Prism, by Lea Verou</a>.

The page consists of a static sidenav and a content area. It loads a markdown-to-html proxy into a Web Worker, then interprets hash-changes as load events for the given path.

The full source is included below.

## assets/index.js

```javascript
var viewer = document.getElementById('viewer');
var viewNav = document.getElementById('viewer-nav');

// Load the markdown conversion worker
var workerCfg = {
	baseUrl: location.origin+location.pathname.slice(0,-1)
};
local.spawnWorkerServer('assets/mdworker.js', workerCfg);

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
			viewer.innerHTML = '<h2>'+res.status+' '+res.reason+'</h2>';
		}
	);
}
window.onhashchange = getContent;
getContent();
```

## assets/mdworker.js

```javascript
importScripts('../local.js');
importScripts('marked.js');
marked.setOptions({ gfm: true, tables: true });

local.worker.setServer(function (request, response) {
	var url = local.worker.config.baseUrl + request.path;
	var mdresponse_ = local.dispatch({ url: url, headers: { accept:'text/plain' }});
	local.pipe(response, mdresponse_,
		function (headers) {
			headers['content-type'] = 'text/html';
			return headers;
		},
		function (md) { return (md) ? marked(md) : ''; }
	);
});
```