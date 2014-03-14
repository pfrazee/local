patchXHR()
==========

---

Patches `XMLHttpRequest` to recognize "httpl:" URIs and correctly dispatch to them. Useful for libraries which rely on XHR and can't easily be ported to use Local.js' dispatcher.

```javascript
local.patchXHR();
var xhr = new XMLHttpRequest();
xhr.open('GET', 'httpl://myserver');
xhr.onreadystatechange = function() {
	if (xhr.readyState == 4) {
		console.log(xhr.getResponseHeader('content-type')); // => 'application/json'
		console.log(xhr.response); // => { foo: 'bar' }
	}
};
xhr.send();
```
---

### local.patchXHR()

Overwrites `XMLHttpRequest` with the localjs dispatcher.
