// CommonClient
// ============
// pfraze 2012
var CommonClient = {};

(function (exports) {

	// Standard DOM Events
	// ===================

	// listen()
	// ======
	// EXPORTED
	// begins event-interception with the given element
	// - within the container, all 'click' and 'submit' events will be consumed
	// - 'request' events will be dispatched by the original dispatching element
	// - draggable elements which produce requests (anchors, form elements) have their drag/drop handlers defined as well
	// parameters:
	// - `container` must be a valid DOM element
	// - `options` may disable event listeners by setting `links`, `forms`, or `dragdrops` to false
	function CommonClient__listen(container, options) {
		if (!container || !(container instanceof Element)) {
			throw "Listen() requires a valid DOM element as a first parameter";
		}

		container.__eventHandlers = [];
		options = options || {};

		var handler;
		if (options.links !== false) {
			handler = { handleEvent:CommonClient__clickHandler, container:container };
			container.addEventListener('click', handler);
			container.__eventHandlers.push(handler);
		}
		if (options.forms !== false) {
			handler = { handleEvent:CommonClient__submitHandler, container:container };
			container.addEventListener('submit', handler);
		}
		if (options.dragdrops !== false) {
			handler = { handleEvent:CommonClient__dragstartHandler, container:container };
			container.addEventListener('dragstart', handler);
			container.__eventHandlers.push(handler);
		}
	}
	function CommonClient__unlisten(container) {
		if (container.__eventHandlers) {
			container.__eventHandlers.forEach(function(handler) {
				container.removeEventListener(handler);
			});
			delete container.__eventHandlers;
		}
		var subscribeElems = container.querySelectorAll('[data-subscribe]');
		Array.prototype.forEach.call(subscribeElems, function(subscribeElem) {
			if (subscribeElem.__subscriptions) {
				for (var url in subscribeElem.__subscriptions) {
					subscribeElem.__subscriptions[url].close();
				}
				delete subscribeElem.__subscriptions;
			}
		});
	}

	// INTERNAL
	// transforms click events into request events
	function CommonClient__clickHandler(e) {
		if (e.button !== 0) { return; } // handle left-click only
		trackFormSubmitter(e.target);
		var request = extractRequest.fromAnchor(e.target);
		if (request && ['_top','_blank'].indexOf(request.target) !== -1) { return; }
		if (request) {
			e.preventDefault();
			e.stopPropagation();
			dispatchRequestEvent(e.target, request);
			return false;
		}
	}

	// INTERNAL
	// transforms submit events into request events
	function CommonClient__submitHandler(e) {
		var request = extractRequest(e.target, this.container);
		if (request && ['_top','_blank'].indexOf(request.target) !== -1) { return; }
		if (request) {
			e.preventDefault();
			e.stopPropagation();
			dispatchRequestEvent(e.target, request);
			return false;
		}
	}

	// INTERNAL
	// builds a 'link' object out of a dragged item
	function CommonClient__dragstartHandler(e) {
		e.dataTransfer.effectAllowed = 'none'; // allow nothing unless there's a valid link
		var link = null, elem = e.target;

		// update our form submitter tracking
		trackFormSubmitter(elem);

		// get request data
		if (elem.tagName == 'A') {
			link = extractRequest.fromAnchor(elem);
		} else if (elem.form) {
			link = extractRequest(elem.form, this.container);
		} /* :TODO: do we need to include fieldsets here? */

		// setup drag/drop behavior
		if (link) {
			e.dataTransfer.effectAllowed = 'link';
			e.dataTransfer.setData('application/request+json', JSON.stringify(link));
			e.dataTransfer.setData('text/uri-list', link.url);
			e.dataTransfer.setData('text/plain', link.url);
		}
	}

	exports.listen = CommonClient__listen;
	exports.unlisten = CommonClient__unlisten;

	// Response Interpretation
	// =======================

	// handleResponse()
	// ==============
	// EXPORTED
	// examines a request's response and inserts it into the DOM according to rules
	function CommonClient__handleResponse(targetElem, containerElem, response) {
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

		var html = '';
		if (response.body) {
			if (/text\/html/.test(response.headers['content-type'])) {
				html = response.body.toString();
			} else {
				// escape non-html so that it can render correctly
				if (typeof response.body == 'string')
					html = response.body.replace(/</g, '&lt;').replace(/>/g, '&gt;');
				else
					html = JSON.stringify(response.body);
			}
		}

		targetElem.innerHTML = html;
		bindAttrEvents(targetElem, containerElem);
		subscribeElements(targetElem, containerElem);
	}

	exports.handleResponse = CommonClient__handleResponse;

	// Event Attributes
	// ================

	// supported extra events
	var attrEvents = ['blur', 'change', 'click', 'dblclick', 'focus', 'keydown', 'keypress', 'keyup', 'load', 'mousedown', 'mousemove', 'mouseout', 'mouseover', 'mouseup', 'reset', 'select', 'submit', 'unload'];

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
			var url = subscribeElem.dataset['subscribe'];
			subscribeElem.__subscriptions = subscribeElem.__subscriptions || {};
			var stream = subscribeElem.__subscriptions[url];
			if (!stream)
				stream = subscribeElem.__subscriptions[url] = Link.subscribe({ url:url });
			stream.on('update', makeUpdateEventHandler(url, subscribeElem));
			stream.on('error', makeErrorEventHandler());
		});
	}

	function makeUpdateEventHandler(url, targetElem) {
		return function(m) {
			var request = { method:'get', url:url, target:"_elem", headers:{ accept:'text/html' }};
			dispatchRequestEvent(targetElem, request);
		};
	}

	function makeErrorEventHandler() {
		return function(e) {
			var err = e.data;
			console.log('Client update stream error:', err);
		};
	}

	// Helpers
	// =======

	// INTERNAL
	// searches up the node tree for an element
	function findParentNode(node, test) {
		while (node) {
			if (test(node)) { return node; }
			node = node.parentNode;
		}
		return null;
	}

	findParentNode.byTag = function(node, tagName) {
		return findParentNode(node, function(elem) {
			return elem.tagName == tagName;
		});
	};

	findParentNode.byClass = function(node, className) {
		return findParentNode(node, function(elem) {
			return elem.classList && elem.classList.contains(className);
		});
	};

	findParentNode.byElement = function(node, element) {
		return findParentNode(node, function(elem) {
			return elem === element;
		});
	};

	findParentNode.thatisFormRelated = function(node) {
		return findParentNode(node, function(elem) {
			return !!elem.form;
		});
	};

	// combines parameters as objects
	// - precedence is rightmost
	//     reduceObjects({a:1}, {a:2}, {a:3}) => {a:3}
	function reduceObjects() {
		var objs = Array.prototype.slice.call(arguments);
		var acc = {}, obj;
		while (objs.length) {
			obj = objs.shift();
			if (!obj) { continue; }
			for (var k in obj) {
				if (!obj[k]) { continue; }
				if (typeof obj[k] == 'object' && !Array.isArray(obj[k])) {
					acc[k] = reduceObjects(acc[k], obj[k]);
				} else {
					acc[k] = obj[k];
				}
			}
		}
		return acc;
	}

	// INTERNAL
	// dispatches a request event, stopping the given event
	function dispatchRequestEvent(targetElem, request) {
		var re = new CustomEvent('request', { bubbles:true, cancelable:true, detail:request });
		targetElem.dispatchEvent(re);
	}

	// INTERNAL
	// submit helper, makes it possible to find the button which triggered the submit
	function trackFormSubmitter(node) {
		var elem = findParentNode.thatisFormRelated(node);
		if (elem) {
			for (var i=0; i < elem.form.length; i++) {
				elem.form[i].setAttribute('submitter', null);
			}
			elem.setAttribute('submitter', '1');
		}
	}

	// INTERNAL
	// extracts request from any given element
	function extractRequest(targetElem, containerElem) {
		var requests = { form:{}, fieldset:{}, elem:{} };
		var fieldset = null, form = null;

		// find parent fieldset
		if (targetElem.tagName === 'FIELDSET') {
			fieldset = targetElem;
		} else if (targetElem.tagName !== 'FORM') {
			fieldset = findParentNode.byTag(targetElem, 'FIELDSET');
		}

		// find parent form
		if (targetElem.tagName === 'FORM') {
			form = targetElem;
		} else {
			// :TODO: targetElem.form may be a simpler alternative
			var formId = targetElem.getAttribute('form') || (fieldset ? fieldset.getAttribute('form') : null);
			if (formId) {
				form = containerElem.querySelector('#'+formId);
			}
			if (!form) {
				form = findParentNode.byTag(targetElem, 'FORM');
			}
		}

		// extract payload
		var payload = extractRequestPayload(targetElem, form);
		
		// extract form headers
		if (form) {
			requests.form = extractRequest.fromForm(form, targetElem);
		}

		// extract fieldset headers
		if (fieldset) {
			requests.fieldset = extractRequest.fromFormElement(fieldset);
		}

		// extract element headers
		if (targetElem.tagName === 'A') {
			requests.elem = extractRequest.fromAnchor(targetElem);
		} else if (['FORM','FIELDSET'].indexOf(targetElem.tagName) === -1) {
			requests.elem = extractRequest.fromFormElement(targetElem);
		}

		// combine then all, with precedence given to rightmost objects in param list
		var req = reduceObjects(requests.form, requests.fieldset, requests.elem);
		var payloadWrapper = {};
		payloadWrapper[/GET/i.test(req.method) ? 'query' : 'body'] = payload;
		return reduceObjects(req, payloadWrapper);
	}

	// INTERNAL
	// extracts request parameters from an anchor tag
	extractRequest.fromAnchor = function(node) {

		// get the anchor
		node = findParentNode.byTag(node, 'A');
		if (!node) { return null; }

		// pull out params
		var request = {
			method  : 'get',
			url     : node.attributes.href.value,
			target  : node.getAttribute('target'),
			headers : { accept:node.getAttribute('type') }
		};
		return request;
	};

	// INTERNAL
	// extracts request parameters from a form element (inputs, textareas, etc)
	extractRequest.fromFormElement = function(node) {
		
		// :TODO: search parent for the form-related element?
		//        might obviate the need for submitter-tracking

		// pull out params
		var request = {
			method  : node.getAttribute('formmethod'),
			url     : node.getAttribute('formaction'),
			target  : node.getAttribute('formtarget'),
			headers : { 'content-type':node.getAttribute('formenctype') }
		};
		return request;
	};

	// INTERNAL
	// extracts request parameters from a form
	extractRequest.fromForm = function(form, submittingElem) {

		// find the submitter, if the submitting element is not form-related
		if (submittingElem && !submittingElem.form) {
			for (var i=0; i < form.length; i++) {
				var elem = form[i];
				if (elem.getAttribute('submitter') == '1') {
					submittingElem = elem;
					elem.setAttribute('submitter', '0');
					break;
				}
			}
		}

		var requests = { submitter:{}, form:{} };
		// extract submitting element headers
		if (submittingElem) {
			requests.submitter = {
				method  : submittingElem.getAttribute('formmethod'),
				url     : submittingElem.getAttribute('formaction'),
				target  : submittingElem.getAttribute('formtarget'),
				headers : { 'content-type':submittingElem.getAttribute('formenctype') }
			};
		}
		// extract form headers
		requests.form = {
			method  : form.getAttribute('method'),
			url     : form.getAttribute('action'),
			target  : form.getAttribute('target'),
			headers : { 'content-type':form.getAttribute('enctype') || form.enctype }
		};
		if (form.acceptCharset) { requests.form.headers.accept = form.acceptCharset; }

		// combine, with precedence to the submitting element
		var request = reduceObjects(requests.form, requests.submitter);

		// strip the base URI
		// :TODO: needed?
		/*var base_uri = window.location.href.split('#')[0];
		if (target_uri.indexOf(base_uri) != -1) {
			target_uri = target_uri.substring(base_uri.length);
			if (target_uri.charAt(0) != '/') { target_uri = '/' + target_uri; }
		}*/

		return request;
	};

	// INTERNAL
	// serializes all form elements beneath and including the given element
	function extractRequestPayload(targetElem, form) {

		// iterate form elements
		var data = {};
		for (var i=0; i < form.length; i++) {
			var elem = form[i];

			// skip if not a child of the target element
			if (!findParentNode.byElement(elem, targetElem)) {
				continue;
			}

			// pull value if it has one
			var isSubmittingElem = elem.getAttribute('submitter') == '1';
			if (elem.tagName === 'BUTTON') {
				if (isSubmittingElem) {
					// don't pull from buttons unless recently clicked
					data[elem.name] = elem.value;
				}
			} else if (elem.tagName === 'INPUT') {
				switch (elem.type.toLowerCase()) {
					case 'button':
					case 'submit':
						if (isSubmittingElem) {
							// don't pull from buttons unless recently clicked
							data[elem.name] = elem.value;
						}
						break;
					case 'checkbox':
						if (elem.checked) {
							// don't pull from checkboxes unless checked
							data[elem.name] = (data[elem.name] || []).concat(elem.value);
						}
						break;
					case 'radio':
						if (elem.getAttribute('checked') !== null) {
							// don't pull from radios unless selected
							data[elem.name] = elem.value;
						}
						break;
					default:
						data[elem.name] = elem.value;
						break;
				}
			} else
				data[elem.name] = elem.value;
		}

		return data;
	}

	exports.findParentNode = findParentNode;
	exports.extractRequest = extractRequest;

})(CommonClient);

// set up for node or AMD
if (typeof module !== "undefined") {
	module.exports = CommonClient;
}
else if (typeof define !== "undefined") {
	define([], function() {
		return CommonClient;
	});
}