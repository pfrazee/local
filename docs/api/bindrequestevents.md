bindRequestEvents()
===================

---

```javascript
local.bindRequestEvents(document.body);
document.body.addEventListener('request', function(e) { local.dispatch(e.detail); });
```
Converts unhandled 'click' and 'submit' events into custom 'request' events. Allows links and forms to target 'httpl' hosts.

### local.bindRequestEvents(element)

 - `element`: required Element, sets the area which will capture events

---

### Request Generation

Local.js extracts request parameters from the HTML element attributes. Elements with `target` set to "_top" or "_blank" are not caught, causing them to execute their default behavior.

```markup
<a href="httpl://foo">Foo</a>
<!-- generates { url: 'httpl://foo' } -->

<a href="httpl://foo" method="NOTIFY" target="bar" type="application/json">Foo</a>
<!-- generates { url: 'httpl://foo', method: 'NOTIFY', target: 'bar', type: 'application/json' } -->

<form action="httpl://foo" method="POST">
	<input type="text" name="a" />
	<input type="checkbox" name="b" />
	<button name="c" value="btnvalue">Submit</button>
</form>
<!-- generates {
  url: 'httpl://foo',
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: { a: ..., b: true/false, c: 'btnvalue' }
} -->
```

---

### Form Overrides

The button that was clicked to submit the form will have its value added to the body, if set. Additionally, the submitting element (and its wrapping fieldset) can override request options.

```markup
<form action="httpl://foo" method="POST" enctype="application/json" accept="text/html" target="alice">
	<!-- request 1 -->
	<button>Submit</button>

	<!-- request 2 -->
	<button formaction="httpl://bar"
			formmethod="PUT"
			formenctype="application/x-www-form-urlencoded"
			formaccept="application/json"
			formtarget="bob">Submit</button>

	<!-- request 3 -->
	<fieldset formaction="httpl://baz"
			formmethod="PATCH"
			formenctype="application/json"
			formaccept="application/json"
			formtarget="charlie">
		<button>Submit</button>
	</fieldset>
</form>
```

Each of the buttons in this example will produce a different request.

---

### Element Aliases

If you want a non-`<a>` element to generate requests, use the `data-local-alias` attribute.

```markup
<p data-local-alias="a" href="httpl://foo" method="NOTIFY" target="bar" type="application/json">Foo</p>
<!-- handles a click event the same as: -->
<a href="httpl://foo" method="NOTIFY" target="bar" type="application/json">Foo</a>
```

Currently, "a" is the only supported alias, but "button" is planned for future releases to add form-submit behavior to arbitrary elements.

---

### File Uploads

If a form includes an `<input type="file">`, Local.js will use the `FileReader` API to load the file and include it in the request body. This is an asyncronous process, so you should call `finishPayloadFileReads()` before dispatching the request.

```javascript
document.body.addEventListener('request', function(e) {
	local.util.finishPayloadFileReads(e.detail)
		.then(function(request) {
			local.dispatch(request);
		});
});

```

### local.util.finishPayloadFileReads(request)

 - `request`: required `local.Request`
 - returns `local.Promise`