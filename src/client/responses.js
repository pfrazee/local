// Response Interpretation
// =======================

// supported on* events
var attrEvents = ['blur', 'change', 'click', 'dblclick', 'focus', 'keydown', 'keypress', 'keyup',
	'load', 'mousedown', 'mousemove', 'mouseout', 'mouseover', 'mouseup', 'reset', 'select', 'submit', 'unload'];

// handleResponse()
// ==============
// EXPORTED
// examines a request's response and inserts it into the DOM according to rules
function LocalClient__handleResponse(targetElem, containerElem, response) {
	response.headers = response.headers || {};

	// react to the response
	switch (response.status) {
	case 204:
		// no content
		break;
	case 205:
		// reset form
		// :TODO: should this try to find a parent form to targetElem?
		if (targetElem.tagName === 'FORM') {
			targetElem.reset();
		}
		break;
	case 303:
		// dispatch for contents
		var request = { method:'get', url:response.headers.location, headers:{ accept:'text/html' }};
		dispatchRequestEvent(targetElem, request);
		break;
	default:
		// replace target innards
		renderResponse(targetElem, containerElem, response);
	}
}

// INTERNAL
// replaces the targetElem's innerHTML with the response payload
function renderResponse(targetElem, containerElem, response) {

	if (response.body) {
		var type = response.headers['content-type'];
		if (/application\/html\-deltas\+json/.test(type)) {
			if (typeof response.body != 'object')
				console.log('Improperly-formed application/html-deltas+json object', response);
			else {
				for (var op in response.body)
					renderHtmlDeltas(op, response.body[op], targetElem, containerElem);
			}
		} else {
			var html = '';
			if (/text\/html/.test(type))
				html = response.body.toString();
			else {
				// escape non-html so that it can render correctly
				if (typeof response.body == 'string')
					html = response.body.replace(/</g, '&lt;').replace(/>/g, '&gt;');
				else
					html = JSON.stringify(response.body);
			}
			targetElem.innerHTML = html;
		}
	}

	bindAttrEvents(targetElem, containerElem);
	subscribeElements(targetElem, containerElem);
}

function renderHtmlDeltas(op, deltas, targetElem, containerElem) {
	if (typeof deltas != 'object')
		return;
	for (var selector in deltas) {
		var i, ii, elems = containerElem.querySelectorAll(selector);
		var addClass = function(cls) { elems[i].classList.add(cls); };
		var removeClass = function(cls) { elems[i].classList.remove(cls); };
		var toggleClass = function(cls) { elems[i].classList.toggle(cls); };
		for (i=0, ii=elems.length; i < ii; i++) {
			if (!elems[i]) continue;
			switch (op) {
				case 'replace':
					elems[i].innerHTML = deltas[selector];
					break;
				case 'append':
					elems[i].innerHTML = elems[i].innerHTML + deltas[selector];
					break;
				case 'prepend':
					elems[i].innerHTML = deltas[selector] + elems[i].innerHTML;
					break;
				case 'addClass':
					if (elems[i].classList)
						deltas[selector].split(' ').forEach(addClass);
					break;
				case 'removeClass':
					if (elems[i].classList)
						deltas[selector].split(' ').forEach(removeClass);
					break;
				case 'toggleClass':
					if (elems[i].classList)
						deltas[selector].split(' ').forEach(toggleClass);
					break;
			}
		}
	}
}

// INTERNAL
// searches elements for event attributes (on*) and binds a listener which dispatches a request event
// - attribute value determines the request method (post, put, patch, etc)
function bindAttrEvents(targetElem, containerElem) {
	
	// find all elements with on* attributes
	attrEvents.forEach(function(eventName) {
		var eventAttr = 'on'+eventName;
		var elements = targetElem.querySelectorAll('['+eventAttr+']');
		Array.prototype.forEach.call(elements, function(elem) {
			// bind event handlers based on the given model
			var method = elem.getAttribute(eventAttr);
			elem.addEventListener(eventName, makeAttrEventHandler(method, containerElem));
			elem.removeAttribute(eventAttr);
		});
	});
}

// INTERNAL
// provides an event handler which dispatches a request event
function makeAttrEventHandler(method, containerElem) {
	return function(e) {
		// build request
		request = extractRequest(e.currentTarget, containerElem);
		request.method = method;

		// move the params into the body if not a GET
		// (extractRequest would have used the wrong method to judge this)
		if (/GET/i.test(method) === false && !request.body) {
			request.body = request.query;
			delete request.query;
		}

		// dispatch request event
		if (request) {
			e.preventDefault();
			e.stopPropagation();
			dispatchRequestEvent(e.target, request);
			return false;
		}
	};
}

// INTERNAL
// subscribes all child elements with 'data-subscribe' to 'update' events coming from specified url
// - when the update message is received, will issue a GET request for new HTML
function subscribeElements(targetElem, containerElem) {

	// find subscribe elems
	var subscribeElems = targetElem.querySelectorAll('[data-subscribe]');

	Array.prototype.forEach.call(subscribeElems, function(subscribeElem) {
		// subscribe to server's events
		var url = subscribeElem.dataset.subscribe;
		subscribeElem.__subscriptions = subscribeElem.__subscriptions || {};
		var stream = subscribeElem.__subscriptions[url];
		if (!stream)
			stream = subscribeElem.__subscriptions[url] = local.http.subscribe({ url:url });
		stream.on('update', makeUpdateEventHandler(url, subscribeElem));
		stream.on('error', makeErrorEventHandler());
	});
}

function makeUpdateEventHandler(url, targetElem) {
	return function(m) {
		var request = { method:'get', url:url, target:"_element", headers:{ accept:'text/html' }};
		dispatchRequestEvent(targetElem, request);
	};
}

function makeErrorEventHandler() {
	return function(e) {
		var err = e.data;
		console.log('Client update stream error:', err);
	};
}

local.client.handleResponse = LocalClient__handleResponse;