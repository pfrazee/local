// Response Interpretation
// =======================

// supported on* events
var attrEvents = ['blur', 'change', 'click', 'dblclick', 'focus', 'keydown', 'keypress', 'keyup',
	'load', 'mousedown', 'mousemove', 'mouseout', 'mouseover', 'mouseup', 'reset', 'select', 'submit', 'unload'];

// renderResponse()
// ==============
// EXPORTED
// replaces the targetElem's innerHTML with the response payload
function renderResponse(targetElem, containerElem, response) {

	response.body = response.body || '';
	var type = response.headers['content-type'];
	if (/application\/html\-deltas\+json/.test(type)) {
		if (typeof response.body != 'object' || !Array.isArray(response.body))
			console.log('Improperly-formed application/html-deltas+json object', response);
		else {
			if (Array.isArray(response.body[0])) {
				response.body.forEach(function(delta) {
					renderHtmlDelta(delta, targetElem, containerElem);
				});
			} else
				renderHtmlDelta(response.body, targetElem, containerElem);
		}
	} else {
		// format the output by type
		var html = '';
		if (/text\/html/.test(type))
			html = response.body.toString();
		else {
			// escape non-html so that it can render correctly
			if (typeof response.body != 'string')
				html = JSON.stringify(response.body);
			html = '<pre>'+response.body.replace(/</g, '&lt;').replace(/>/g, '&gt;')+'</pre>';
		}

		local.client.unlisten(targetElem); // make sure to unregister listeners before replaceing
		targetElem.innerHTML = html;
		local.env.postProcessRegion(targetElem, containerElem);
	}

	bindAttrEvents(targetElem, containerElem);
	subscribeElements(targetElem, containerElem);
}

function renderHtmlDelta(delta, targetElem, containerElem) {
	if (typeof delta != 'object' || !Array.isArray(delta))
		return;
	var i, ii, region;
	var op = delta.shift(), selector = delta.shift(), args = delta;
	if (!op || !selector)
		return;
	var elems = containerElem.querySelectorAll(selector);
	var addClass = function(cls) { elems[i].classList.add(cls); };
	var removeClass = function(cls) { elems[i].classList.remove(cls); };
	var toggleClass = function(cls) { elems[i].classList.toggle(cls); };
	for (i=0, ii=elems.length; i < ii; i++) {
		if (!elems[i]) continue;
		var elem = elems[i];
		switch (op) {
			case 'replace':
				local.client.unlisten(elem); // destructive update, do unlisten
				elem.innerHTML = args[0];
				local.env.postProcessRegion(elem, containerElem);
				break;
			case 'remove':
				local.client.unlisten(elem); // destructive update, do unlisten
				elem.parentNode.removeChild(elem);
				break;
			case 'append':
				elem.innerHTML = elem.innerHTML + args[0];
				local.env.postProcessRegion(elem, containerElem);
				break;
			case 'prepend':
				elem.innerHTML = args[0] + elem.innerHTML;
				local.env.postProcessRegion(elem, containerElem);
				break;
			case 'addClass':
				if (elem.classList)
					(args[0]||'').split(' ').forEach(addClass);
				break;
			case 'removeClass':
				if (elem.classList)
					(args[0]||'').split(' ').forEach(removeClass);
				break;
			case 'toggleClass':
				if (elem.classList)
					(args[0]||'').split(' ').forEach(toggleClass);
				break;
			case 'setAttribute':
				if (args[0])
					elem.setAttribute(args[0], args[1]);
				break;
			case 'navigate':
				region = local.env.getClientRegion(elem.id);
				if (region)
					region.dispatchRequest(args[0]);
				else
					console.log('html-delta navigate targeted non-client-region element', elem, selector);
				break;
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
		e.preventDefault();
		e.stopPropagation();

		// build request
		var request = extractRequest(e.currentTarget, containerElem);
		request.method = method;
		finishPayloadFileReads(request).then(function() {

			// move the query into the body if not a GET
			// (extractRequest would have used the wrong method to judge this)
			var isGET = /GET/i.test(method);
			if (!isGET && !request.body) {
				request.body = request.query;
				request.query = {};
			}
			// visa-versa
			else if (isGET && request.body) {
				request.query = reduceObjects(request.body, request.query);
				request.body = {};
			}

			// dispatch request event
			dispatchRequestEvent(e.target, request);
		});
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
		var subParts = subscribeElem.dataset.subscribe.split(' ');
		var eventsUrl = subParts[0];
		var getUrl = subParts[1] || eventsUrl;

		subscribeElem.__subscriptions = subscribeElem.__subscriptions || {};
		var stream = subscribeElem.__subscriptions[eventsUrl];
		if (!stream) {
			stream = subscribeElem.__subscriptions[eventsUrl] = local.web.subscribe({ url:eventsUrl });
			stream.on('update', makeUpdateEventHandler(getUrl, subscribeElem));
			stream.on('error', makeErrorEventHandler());
		}
	});
}

function makeUpdateEventHandler(url, targetElem) {
	return function(m) {
		var request = { method:'get', url:url, target:"_element", headers:{ accept:'text/html' }};
		if (targetElem.tagName == 'FORM') {
			// serialize the form values in the query
			request.query = extractRequestPayload(targetElem, targetElem, { nofiles:true });
			// see if the form has its own accept
			request.headers.accept = targetElem.getAttribute('accept') || 'text/html';
		}
		dispatchRequestEvent(targetElem, request);
	};
}

function makeErrorEventHandler() {
	return function(e) {
		var err = e.data;
		console.log('Client update stream error:', err);
	};
}

local.client.renderResponse = renderResponse;