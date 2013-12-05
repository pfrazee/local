GrimWidget.js
=============

---

To simplify the connection process, <a href="https://github.com/grimwire/grimwire">Grimwire includes grimwidget.js</a> (<a href="https://raw.github.com/grimwire/grimwire/master/grimwidget.js">Direct Link</a>) to use in applications. The GrimWidget gives a popup interface for inputting the relay URL and rendering links in the relay's index.

<img src="assets/docs-grimwidget.png">

```javascript
// An example from chat.grimwire.com
grimwidget.create({
	triggerEl: document.querySelector('#conn-status a'),
	halign: 'right',
	render: function (el, links) {
		// Render room list from available links
		links = local.queryLinks(links, { rel: 'chat.grimwire.com/room' });
		if (links.length) {
			// Remove duplicates
			var added = {};
			links = links.filter(function(link) {
				var isfirst = !added[link.href];
				added[link.href] = true;
				return isfirst;
			});
		}
		el.innerHTML = renderRoomList({ links: links });
	}
});
```

---

## grimwidget

### .getRelay()

GrimWidget.js creates and manages a `Relay` instance for all widget instances. Use this function to get that relay.

### .create({ triggerEl:, <span class="muted">render:</span>, <span class="muted">halign:</span>, <span class="muted">hostuser:</span> })

 - `triggerEl`: required Element, the DOM node that, when clicked, will create the popup
 - `render`: optional function(listEl, links), overrides the link-rendering behavior when the popup is opened
 - `renderLabel`: optional function(), overrides the text label-rendering behavior when the relay state's changes
 - `halign`: optional string, must be 'left' or 'right' (default 'left')
 - `valign`: optional string, must be 'top' or 'bottom' (default 'bottom')
 - `width`: optional number, the width of the popup in pixels (default 300)
 - `hostuser`: optional string, populates the "host user" field in case the user needs a guest account
 - `defaultOpen`: optional bool, opens the popup on load if true
 - returns `grimwidget.GrimWidget`

---

## grimwidget.GrimWidget

### .open()

Opens the widget, if closed.

### .close()

Closes the widget, if open.

### .refresh()

Redraws the widget, if open.