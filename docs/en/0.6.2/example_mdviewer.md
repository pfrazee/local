Example: Markdown Viewer
========================

---

This docs site is a Markdown viewer built with <a href="https://github.com/chjj/marked">Marked, by Christopher Jeffrey</a>, and <a href="https://github.com/LeaVerou/prism">Prism, by Lea Verou</a>.

The page consists of a static sidenav and a content area. It loads a markdown-to-html proxy into a Web Worker, then interprets hash-changes as load events for the given path.

The full source is included below.

## assets/index.js

```javascript
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
			viewer.innerHTML = '<h2>'+res.status+' '+res.reason+'</h2>';
		});
}
window.onhashchange = getContent;
getContent();
```

## assets/mdworker.js

```javascript
importScripts('../local.js');
importScripts('./marked.js');
marked.setOptions({ gfm: true, tables: true });

function main(req, res) {
	req.on('end', function() {
		res.writeHead(200, 'OK', {'Content-Type': 'text/html'});
		res.end(marked(''+req.body));
	});
}
```