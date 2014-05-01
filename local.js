;(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// Worker API whitelisting code
// ============================
var whitelist = [ // a list of global objects which are allowed in the worker
	'null', 'self', 'console', 'atob', 'btoa',
	'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
	'Proxy',
	'importScripts', 'navigator',
	'postMessage', 'addEventListener', 'removeEventListener',
	'onmessage', 'onerror', 'onclose',
	'dispatchEvent'
];
var blacklist = [ // a list of global objects which are not allowed in the worker, and which dont enumerate on `self` for some reason
	'XMLHttpRequest', 'WebSocket', 'EventSource',
    'FileReaderSync',
	'Worker'
];
var whitelistAPIs_src = [ // nullifies all toplevel variables except those listed above in `whitelist`
	'(function() {',
		'var nulleds=[];',
		'var whitelist = ["'+whitelist.join('", "')+'"];',
		'for (var k in self) {',
			'if (whitelist.indexOf(k) === -1) {',
				'Object.defineProperty(self, k, { value: null, configurable: false, writable: false });',
				'nulleds.push(k);',
			'}',
		'}',
		'var blacklist = ["'+blacklist.join('", "')+'"];',
		'blacklist.forEach(function(k) {',
			'Object.defineProperty(self, k, { value: null, configurable: false, writable: false });',
			'nulleds.push(k);',
		'});',
		'if (typeof console != "undefined") { console.log("Nullified: "+nulleds.join(", ")); }',
	'})();\n'
].join('');
var importScriptsPatch_src = [ // patches importScripts() to allow relative paths despite the use of blob uris
	'(function() {',
		'var orgImportScripts = importScripts;',
		'function joinRelPath(base, relpath) {',
			'if (relpath.charAt(0) == \'/\') {',
				'return "<HOST>" + relpath;',
			'}',
			'// totally relative, oh god',
			'// (thanks to geoff parker for this)',
			'var hostpath = "<HOST_DIR_PATH>";',
			'var hostpathParts = hostpath.split(\'/\');',
			'var relpathParts = relpath.split(\'/\');',
			'for (var i=0, ii=relpathParts.length; i < ii; i++) {',
				'if (relpathParts[i] == \'.\')',
					'continue; // noop',
				'if (relpathParts[i] == \'..\')',
					'hostpathParts.pop();',
				'else',
					'hostpathParts.push(relpathParts[i]);',
			'}',
			'return "<HOST>/" + hostpathParts.join(\'/\');',
		'}',
		'var isImportingAllowed = true;',
		'setTimeout(function() { isImportingAllowed = false; },0);', // disable after initial run
		'importScripts = function() {',
			'if (!isImportingAllowed) { throw "Local.js - Imports disabled after initial load to prevent data-leaking"; }',
			'return orgImportScripts.apply(null, Array.prototype.map.call(arguments, function(v, i) {',
				'return (v.indexOf(\'/\') < v.indexOf(/[.:]/) || v.charAt(0) == \'/\' || v.charAt(0) == \'.\') ? joinRelPath(\'<HOST_DIR_URL>\',v) : v;',
			'}));',
		'};',
	'})();\n'
].join('\n');

module.exports = {
	logAllExceptions: false,
    maxActiveWorkers: 10,
	workerBootstrapScript: whitelistAPIs_src+importScriptsPatch_src
};
},{}],2:[function(require,module,exports){
module.exports = {
	// Local status codes
	// ==================
	// used to specify client operation states

	// link query failed to match
	LINK_NOT_FOUND: 1
};
},{}],3:[function(require,module,exports){
var util = require('./util');

module.exports = {
	Request: require('./web/request.js'),
	Response: require('./web/response.js'),
	Bridge: require('./web/bridge.js'),
	UriTemplate: require('./web/uri-template.js'),

	util: util,
	schemes: require('./web/schemes.js'),
	httpHeaders: require('./web/http-headers.js'),
	contentTypes: require('./web/content-types.js')
};
util.mixin.call(module.exports, require('./constants.js'));
util.mixin.call(module.exports, require('./config.js'));
util.mixin.call(module.exports, require('./promises.js'));
util.mixin.call(module.exports, require('./request-event.js'));
util.mixin.call(module.exports, require('./web/helpers.js'));
util.mixin.call(module.exports, require('./web/httpl.js'));
util.mixin.call(module.exports, require('./web/workers.js'));
// util.mixin.call(module.exports, require('./web/subscribe.js'));
// util.mixin.call(module.exports, require('./web/agent.js'));

// Request sugars
function dispatch(headers) {
	var req = new module.exports.Request(headers);
	req.bufferResponse(true);
	util.nextTick(function() {
		req.end(); // send next tick
	});
	return req;
}
function makeRequestSugar(method) {
	return function(url, params) {
		return dispatch({ method: method, url: url, params: params });
	};
}
module.exports.dispatch =  dispatch;
module.exports.HEAD =      makeRequestSugar('HEAD');
module.exports.GET =       makeRequestSugar('GET');
module.exports.POST =      makeRequestSugar('POST');
module.exports.PUT =       makeRequestSugar('PUT');
module.exports.PATCH =     makeRequestSugar('PATCH');
module.exports.DELETE =    makeRequestSugar('DELETE');
module.exports.SUBSCRIBE = makeRequestSugar('SUBSCRIBE');
module.exports.NOTIFY =    makeRequestSugar('NOTIFY');

// Create globals
var global, local = module.exports;
if (typeof window != 'undefined') global = window;
else if (typeof self != 'undefined') global = self;
if (global) {
	global.local     = local;
	global.HEAD      = local.HEAD;
	global.GET       = local.GET;
	global.POST      = local.POST;
	global.PUT       = local.PUT;
	global.PATCH     = local.PATCH;
	global.DELETE    = local.DELETE;
	global.SUBSCRIBE = local.SUBSCRIBE;
	global.NOTIFY    = local.NOTIFY;
}

// Run worker setup (does nothing outside of a worker)
require('./worker');
},{"./config.js":1,"./constants.js":2,"./promises.js":4,"./request-event.js":5,"./util":8,"./web/bridge.js":9,"./web/content-types.js":10,"./web/helpers.js":11,"./web/http-headers.js":12,"./web/httpl.js":13,"./web/request.js":16,"./web/response.js":17,"./web/schemes.js":18,"./web/uri-template.js":19,"./web/workers.js":20,"./worker":21}],4:[function(require,module,exports){
var localConfig = require('./config.js');
var util = require('./util');

function isPromiselike(p) {
	return (p && typeof p.then == 'function');
}

// Promise
// =======
// EXPORTED
// Monadic function chaining around asynchronously-fulfilled values
// - conformant with the promises/a+ spec
// - better to use the `promise` function to construct
function Promise(value) {
	this.succeedCBs = []; // used to notify about fulfillments
	this.failCBs = []; // used to notify about rejections
	this.__hasValue = false;
	this.__hasFailed = false;
	this.value = undefined;
	if (value)
		this.fulfill(value);
}
Promise.prototype.isUnfulfilled = function() { return !this.__hasValue; };
Promise.prototype.isRejected = function() { return this.__hasFailed; };
Promise.prototype.isFulfilled = function() { return (this.__hasValue && !this.__hasFailed); };

// helper function to execute `then` behavior
function execCallback(parentPromise, targetPromise, fn) {
	if (fn === null) {
		if (parentPromise.isRejected())
			targetPromise.reject(parentPromise.value);
		else
			targetPromise.fulfill(parentPromise.value);
	} else {
		var newValue;
		try { newValue = fn(parentPromise.value); }
		catch (e) {
			if (localConfig.logAllExceptions || e instanceof Error) {
				if (console.error)
					console.error(e, e.stack);
				else console.log("Promise exception thrown", e, e.stack);
			}
			return targetPromise.reject(e);
		}

		if (isPromiselike(newValue))
			promise(newValue).chain(targetPromise);
		else
			targetPromise.fulfill(newValue);
	}
}

// add a 'succeed' and an 'fail' function to the sequence
Promise.prototype.then = function(succeedFn, failFn) {
	succeedFn = (succeedFn && typeof succeedFn == 'function') ? succeedFn : null;
	failFn    = (failFn    && typeof failFn == 'function')    ? failFn    : null;

	var p = promise();
	if (this.isUnfulfilled()) {
		this.succeedCBs.push({ p:p, fn:succeedFn });
		this.failCBs.push({ p:p, fn:failFn });
	} else {
		var self = this;
		//util.nextTick(function() {
			if (self.isFulfilled())
				execCallback(self, p, succeedFn);
			else
				execCallback(self, p, failFn);
		//});
	}
	return p;
};

// add a non-error function to the sequence
// - will be skipped if in 'error' mode
Promise.prototype.succeed = function(fn) {
	if (this.isRejected()) {
		return this;
	} else {
		var args = Array.prototype.slice.call(arguments, 1);
		return this.then(function(v) {
			return fn.apply(null, [v].concat(args));
		});
	}
};

// add an error function to the sequence
// - will be skipped if in 'non-error' mode
Promise.prototype.fail = function(fn) {
	if (this.isFulfilled()) {
		return this;
	} else {
		var args = Array.prototype.slice.call(arguments, 1);
		return this.then(null, function(v) {
			return fn.apply(null, [v].concat(args));
		});
	}
};

// add a function to the success and error paths of the sequence
Promise.prototype.always = function(fn) {
	return this.then(fn, fn);
};

// sets the promise value, enters 'succeed' mode, and executes any queued `then` functions
Promise.prototype.fulfill = function(value) {
	if (this.isUnfulfilled()) {
		this.value = value;
		this.__hasValue = true;
		for (var i=0; i < this.succeedCBs.length; i++) {
			var cb = this.succeedCBs[i];
			execCallback(this, cb.p, cb.fn);
		}
		this.succeedCBs.length = 0;
		this.failCBs.length = 0;
	}
	return this;
};

// sets the promise value, enters 'error' mode, and executes any queued `then` functions
Promise.prototype.reject = function(err) {
	if (this.isUnfulfilled()) {
		this.value = err;
		this.__hasValue = true;
		this.__hasFailed = true;
		for (var i=0; i < this.failCBs.length; i++) {
			var cb = this.failCBs[i];
			execCallback(this, cb.p, cb.fn);
		}
		this.succeedCBs.length = 0;
		this.failCBs.length = 0;
	}
	return this;
};

// releases all of the remaining references in the prototype chain
// - to be used in situations where promise handling will not continue, and memory needs to be freed
Promise.prototype.cancel = function() {
	// propagate the command to promises later in the chain
	var i;
	for (i=0; i < this.succeedCBs.length; i++) {
		this.succeedCBs[i].p.cancel();
	}
	for (i=0; i < this.failCBs.length; i++) {
		this.failCBs[i].p.cancel();
	}
	// free up memory
	this.succeedCBs.length = 0;
	this.failCBs.length = 0;
	return this;
};

// sets up the given promise to fulfill/reject upon the method-owner's fulfill/reject
Promise.prototype.chain = function(otherPromise) {
	this.then(
		function(v) {
			promise(otherPromise).fulfill(v);
			return v;
		},
		function(err) {
			promise(otherPromise).reject(err);
			return err;
		}
	);
	return otherPromise;
};

// provides a node-style function for fulfilling/rejecting based on the (err, result) pattern
Promise.prototype.cb = function(err, value) {
	if (err)
		this.reject(err);
	else
		this.fulfill((typeof value == 'undefined') ? null : value);
};

// bundles an array of promises into a single promise that requires none to succeed for a pass
// - `shouldFulfillCB` is called with (results, fails) to determine whether to fulfill or reject
function bundle(ps, shouldFulfillCB) {
	if (!Array.isArray(ps)) ps = [ps];
	var p = promise(), nPromises = ps.length, nFinished = 0;
	if (nPromises === 0) {
		p.fulfill([]);
		return p;
	}

	var results = []; results.length = nPromises;
	var fails = [];
	var addResult = function(v, index, isfail) {
		results[index] = v;
		if (isfail) fails.push(index);
		if ((++nFinished) == nPromises) {
			if (!shouldFulfillCB) p.fulfill(results);
			else if (shouldFulfillCB(results, fails)) p.fulfill(results);
			else p.reject(results);
		}
	};
	for (var i=0; i < nPromises; i++)
		promise(ps[i]).succeed(addResult, i, false).fail(addResult, i, true);
	return p;
}

// bundles an array of promises into a single promise that requires all to succeed for a pass
function all(ps) {
	return bundle(ps, function(results, fails) {
		return fails.length === 0;
	});
}

// bundles an array of promises into a single promise that requires one to succeed for a pass
function any(ps) {
	return bundle(ps, function(results, fails) {
		return fails.length < results.length;
	});
}

// takes a function and executes it in a Promise context
function lift(fn) {
	var newValue;
	try { newValue = fn(); }
	catch (e) {
		if (localConfig.logAllExceptions || e instanceof Error) {
			if (console.error)
				console.error(e, e.stack);
			else console.log("Promise exception thrown", e, e.stack);
		}
		return promise().reject(e);
	}

	if (isPromiselike(newValue))
		return newValue;
	return promise(newValue);
}

// promise creator
// - behaves like a guard, ensuring `v` is a promise
// - if multiple arguments are given, will provide a promise that encompasses all of them
//   - containing promise always succeeds
function promise(v) {
	if (arguments.length > 1)
		return bundle(Array.prototype.slice.call(arguments));
	if (v instanceof Promise)
		return v;
	if (isPromiselike(v)) {
		var p = promise();
		v.then(function(v2) { p.fulfill(v2); }, function(v2) { p.reject(v2); });
		return p;
	}
	return new Promise(v);
}

module.exports = {
	Promise: Promise,
	promise: promise,
	isPromiselike: isPromiselike
};
promise.bundle = bundle;
promise.all = all;
promise.any = any;
promise.lift = lift;
},{"./config.js":1,"./util":8}],5:[function(require,module,exports){
// Standard DOM Events
// ===================

var util = require('./util');

// bindRequestEvents()
// ===================
// EXPORTED
// Converts 'click' and 'submit' events into custom 'request' events
// - within the container, all 'click' and 'submit' events will be consumed
// - 'request' events will be dispatched by the original dispatching element
// Parameters:
// - `container` must be a valid DOM element
// - `options` may disable event listeners by setting `links` or `forms` to false
function bindRequestEvents(container, options) {
	container.__localEventHandlers = [];
	options = options || {};

	var handler;
	if (options.links !== false) {
		// anchor-click handler
		handler = { name: 'click', handleEvent: Local__clickHandler, container: container };
		container.addEventListener('click', handler, false);
		container.__localEventHandlers.push(handler);
	}
	if (options.forms !== false) {
		// submitter tracking
		handler = { name: 'click', handleEvent: Local__submitterTracker, container: container };
		container.addEventListener('click', handler, true); // must be on capture to happen in time
		container.__localEventHandlers.push(handler);
		// submit handler
		handler = { name: 'submit', handleEvent: Local__submitHandler, container: container };
		container.addEventListener('submit', handler, false);
		container.__localEventHandlers.push(handler);
	}
}

// unbindRequestEvents()
// =====================
// EXPORTED
// Stops listening to 'click' and 'submit' events
function unbindRequestEvents(container) {
	if (container.__localEventHandlers) {
		container.__localEventHandlers.forEach(function(handler) {
			container.removeEventListener(handler.name, handler);
		});
		delete container.__localEventHandlers;
	}
}

// INTERNAL
// transforms click events into request events
function Local__clickHandler(e) {
	if (e.button !== 0) { return; } // handle left-click only
	var request = util.extractRequest.fromAnchor(e.orgtarget || e.target);
	if (request && ['_top','_blank'].indexOf(request.target) !== -1) { return; }
	if (request) {
		e.preventDefault();
		e.stopPropagation();
		util.dispatchRequestEvent(e.target, request);
		return false;
	}
}

// INTERNAL
// marks the submitting element (on click capture-phase) so the submit handler knows who triggered it
function Local__submitterTracker(e) {
	if (e.button !== 0) { return; } // handle left-click only
	util.trackFormSubmitter(e.target);
}

// INTERNAL
// transforms submit events into request events
function Local__submitHandler(e) {
	var request = util.extractRequest(e.target, this.container);
	if (request && ['_top','_blank'].indexOf(request.target) !== -1) { return; }
	if (request) {
		e.preventDefault();
		e.stopPropagation();
		util.finishPayloadFileReads(request).then(function() {
			util.dispatchRequestEvent(e.target, request);
		});
		return false;
	}
}

module.exports = {
	bindRequestEvents: bindRequestEvents,
	unbindRequestEvents: unbindRequestEvents
};
},{"./util":8}],6:[function(require,module,exports){
// Helpers
// =======

if (typeof CustomEvent === 'undefined') {
	// CustomEvent shim (safari)
	// thanks to netoneko https://github.com/maker/ratchet/issues/101
	CustomEvent = function(type, eventInitDict) {
		var event = document.createEvent('CustomEvent');

		event.initCustomEvent(type, eventInitDict['bubbles'], eventInitDict['cancelable'], eventInitDict['detail']);
		return event;
	};
}

// EXPORTED
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

findParentNode.byTagOrAlias = function(node, tagName) {
	return findParentNode(node, function(elem) {
		return elem.tagName == tagName || (elem.dataset && elem.dataset.localAlias && elem.dataset.localAlias.toUpperCase() == tagName);
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
			if (typeof obj[k] == 'undefined' || obj[k] === null) { continue; }
			if (typeof obj[k] == 'object' && !Array.isArray(obj[k])) {
				acc[k] = reduceObjects(acc[k], obj[k]);
			} else {
				acc[k] = obj[k];
			}
		}
	}
	return acc;
}

// EXPORTED
// dispatches a request event, stopping the given event
function dispatchRequestEvent(targetElem, request) {
	var re = new CustomEvent('request', { bubbles:true, cancelable:true, detail:request });
	targetElem.dispatchEvent(re);
}

// EXPORTED
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

// EXPORTED
// extracts request from any given element
function extractRequest(targetElem, containerElem) {
	var requests = { form:{}, elem:{} };
	var form = null;

	// find parent form
	if (targetElem.tagName === 'FORM') {
		form = targetElem;
	} else {
		// :TODO: targetElem.form may be a simpler alternative
		var formId = targetElem.getAttribute('form');
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

	// extract element headers
	if (targetElem.tagName === 'A') {
		requests.elem = extractRequest.fromAnchor(targetElem);
	} else if (['FORM','FIELDSET'].indexOf(targetElem.tagName) === -1) {
		requests.elem = extractRequest.fromFormElement(targetElem);
	}

	// combine then all, with precedence given to rightmost objects in param list
	var req = reduceObjects(requests.form, requests.elem);
	var payloadWrapper = {};
	payloadWrapper[/GET/i.test(req.method) ? 'query' : 'body'] = payload;
	return reduceObjects(req, payloadWrapper);
}

// EXPORTED
// extracts request parameters from an anchor tag
extractRequest.fromAnchor = function(node) {

	// get the anchor
	node = findParentNode.byTagOrAlias(node, 'A');
	if (!node || !node.attributes.href || node.attributes.href.value.charAt(0) == '#') { return null; }

	// pull out params
	var request = {
		method: node.getAttribute('method'),
		url: node.attributes.href.value,
		target: node.getAttribute('target'),
		headers: { accept: node.getAttribute('type') }
	};
	return request;
};

// EXPORTED
// extracts request parameters from a form element (inputs, textareas, etc)
extractRequest.fromFormElement = function(node) {
	// :TODO: search parent for the form-related element?
	//        might obviate the need for submitter-tracking

	// pull out params
	var request = {
		method  : node.getAttribute('formmethod'),
		url     : node.getAttribute('formaction'),
		target  : node.getAttribute('formtarget'),
		headers : {
			'content-type' : node.getAttribute('formenctype'),
			accept         : node.getAttribute('formaccept')
		}
	};
	return request;
};

// EXPORTED
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

	var requests = { submitter:{}, fieldset:{}, form:{} };
	// extract submitting element headers
	if (submittingElem) {
		requests.submitter = {
			method  : submittingElem.getAttribute('formmethod'),
			url     : submittingElem.getAttribute('formaction'),
			target  : submittingElem.getAttribute('formtarget'),
			headers : {
				'content-type' : submittingElem.getAttribute('formenctype'),
				accept         : submittingElem.getAttribute('formaccept')
			}
		};

		// find fieldset(s)
		var fieldsetEl = submittingElem;
		var fieldsetTest = function(elem) { return elem.tagName == 'FIELDSET' || elem.tagName == 'FORM'; };
		while ((fieldsetEl = findParentNode(fieldsetEl.parentNode, fieldsetTest))) {
			if (fieldsetEl.tagName == 'FORM') {
				break; // Stop at the form
			}

			// extract fieldset headers
			if (fieldsetEl) {
				requests.fieldset = reduceObjects(extractRequest.fromFormElement(fieldsetEl), requests.fieldset);
			}
		}
	}
	// extract form headers
	requests.form = {
		method  : form.getAttribute('method'),
		url     : form.getAttribute('action'),
		target  : form.getAttribute('target'),
		headers : {
			'content-type' : form.getAttribute('enctype') || form.enctype,
			'accept'       : form.getAttribute('accept')
		}
	};
	if (form.acceptCharset) { requests.form.headers.accept = form.acceptCharset; }

	// combine, with precedence to the submitting element
	var request = reduceObjects(requests.form, requests.fieldset, requests.submitter);

	// strip the base URI
	// :TODO: needed?
	/*var base_uri = window.location.href.split('#')[0];
	if (target_uri.indexOf(base_uri) != -1) {
		target_uri = target_uri.substring(base_uri.length);
		if (target_uri.charAt(0) != '/') { target_uri = '/' + target_uri; }
	}*/

	return request;
};

// EXPORTED
// serializes all form elements beneath and including the given element
// - `targetElem`: container element, will reject the field if not within (optional)
// - `form`: an array of HTMLElements or a form field (they behave the same for iteration)
// - `opts.nofiles`: dont try to read files in file fields? (optional)
function extractRequestPayload(targetElem, form, opts) {
	if (!opts) opts = {};

	// iterate form elements
	var data = {};
	if (!opts.nofiles)
		data.__fileReads = []; // an array of promises to read <input type=file>s
	for (var i=0; i < form.length; i++) {
		var elem = form[i];

		// skip if it doesnt have a name
		if (!elem.name) {
			continue;
		}

		// skip if not a child of the target element
		if (targetElem && !findParentNode.byElement(elem, targetElem))
			continue;

		// pull value if it has one
		var isSubmittingElem = elem.getAttribute('submitter') == '1';
		if (elem.tagName === 'BUTTON') {
			if (isSubmittingElem) {
				// don't pull from buttons unless recently clicked
				// but, when we do, make sure it's the definitive value (it takes precedence in name collisions)
				Object.defineProperty(data, elem.name, { configurable: true, enumerable: true, writable: false, value: elem.value });
			}
		} else if (elem.tagName === 'INPUT') {
			switch (elem.type.toLowerCase()) {
				case 'button':
				case 'submit':
					if (isSubmittingElem) {
						// don't pull from buttons unless recently clicked
						// but, when we do, make sure it's the definitive value (it takes precedence in name collisions)
						Object.defineProperty(data, elem.name, { configurable: true, enumerable: true, writable: false, value: elem.value });
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
				case 'file':
					// read the files
					if (opts.nofiles)
						break;
					if (elem.multiple) {
						for (var i=0, f; f = elem.files[i]; i++)
							readFile(data, elem, elem.files[i], i);
						data[elem.name] = [];
						data[elem.name].length = i;
					} else {
						readFile(data, elem, elem.files[0]);
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

// INTERNAL
// file read helpers
function readFile(data, elem, file, index) {
	if (!file) return; // no value set
	var reader = new FileReader();
	reader.onloadend = readFileLoadEnd(data, elem, file, index);
	reader.readAsDataURL(file);
}
function readFileLoadEnd(data, elem, file, index) {
	// ^ this avoids a closure circular reference
	var promise = require('../promises.js').promise();
	data.__fileReads.push(promise);
	return function(e) {
		var obj = {
			content: e.target.result || null,
			name: file.name,
			formattr: elem.name,
			size: file.size,
			type: file.type,
			lastModifiedDate: file.lastModifiedDate
		};
		if (typeof index != 'undefined')
			obj.formindex = index;
		promise.fulfill(obj);
	};
}
function finishPayloadFileReads(request) {
	var fileReads = (request.body) ? request.body.__fileReads :
					((request.query) ? request.query.__fileReads : []);
	return require('../promises.js').promise.bundle(fileReads).then(function(files) {
		if (request.body) delete request.body.__fileReads;
		if (request.query) delete request.query.__fileReads;
		files.forEach(function(file) {
			if (typeof file.formindex != 'undefined')
				request.body[file.formattr][file.formindex] = file;
			else request.body[file.formattr] = file;
		});
		return request;
	});
}

module.exports = {
	findParentNode: findParentNode,
	trackFormSubmitter: trackFormSubmitter,
	dispatchRequestEvent: dispatchRequestEvent,
	extractRequest: extractRequest,
	extractRequestPayload: extractRequestPayload,
	finishPayloadFileReads: finishPayloadFileReads
};
},{"../promises.js":4}],7:[function(require,module,exports){
// EventEmitter
// ============
// EXPORTED
// A minimal event emitter, based on the NodeJS api
// initial code borrowed from https://github.com/tmpvar/node-eventemitter (thanks tmpvar)
function EventEmitter() {
	Object.defineProperty(this, '_events', {
		value: {},
		configurable: false,
		enumerable: false,
		writable: true
	});

    Object.defineProperty(this, '_memoHistory', {
		value: null,
		configurable: false,
		enumerable: false,
		writable: true
	});
}
module.exports = EventEmitter;

EventEmitter.prototype.memoEventsTillNextTick = function() {
    this._memoHistory = {};
    require('./index.js').nextTick((function() {
        this._memoHistory = null;
    }).bind(this));
};

EventEmitter.prototype.emit = function(type) {
	var args = Array.prototype.slice.call(arguments);
    args = args.slice(1);

	var handlers = this._events[type];
	if (handlers) {
	    for (var i = 0, l = handlers.length; i < l; i++)
		    handlers[i].apply(this, args);
    }

    if (this._memoHistory) {
        if (!this._memoHistory[type]) { this._memoHistory[type] = []; }
        this._memoHistory[type].push(args);
    }

	return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
	if (Array.isArray(type)) {
		type.forEach(function(t) { this.addListener(t, listener); }, this);
		return;
	}

	if ('function' !== typeof listener) {
		throw new Error('addListener only takes instances of Function');
	}

	// To avoid recursion in the case that type == "newListeners"! Before
	// adding it to the listeners, first emit "newListeners".
	this.emit('newListener', type, listener);

	if (!this._events[type]) {
		this._events[type] = [listener];
	} else {
		this._events[type].push(listener);
	}

    if (this._memoHistory && this._memoHistory[type] && this._memoHistory[type].length) {
        for (var i = 0; i < this._memoHistory[type].length; i++) {
            listener.apply(this, this._memoHistory[type][i]);
        }
    }

	return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
	var self = this;
	self.on(type, function g() {
		self.removeListener(type, g);
		listener.apply(this, arguments);
	});

	return this;
};

EventEmitter.prototype.removeListener = function(type, listener) {
	if ('function' !== typeof listener) {
		throw new Error('removeListener only takes instances of Function');
	}
	if (!this._events[type]) return this;

	var list = this._events[type];
	var i = list.indexOf(listener);
	if (i < 0) return this;
	list.splice(i, 1);
	if (list.length === 0) {
		delete this._events[type];
	}

	return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
	if (type) this._events[type] = null;
	else this._events = {};
	return this;
};

EventEmitter.prototype.clearEvents = function() {
	for (var type in this._events) {
		this.removeAllListeners(type);
	}
	return this;
};

EventEmitter.prototype.listeners = function(type) {
	return this._events[type];
};
},{"./index.js":8}],8:[function(require,module,exports){
var EventEmitter = require('./event-emitter.js');
var DOM = require('./dom.js');

// - must have a `this` bound
// - eg `mixin.call(dest, src)`
function mixin(obj) {
	for (var k in obj)
		this[k] = obj[k];
}

// Adds event-emitter behaviors to the given object
// - should be used on instantiated objects, not prototypes
function mixinEventEmitter(obj) {
	EventEmitter.call(obj);
	mixin.call(obj, EventEmitter.prototype);
}

// http://jsperf.com/cloning-an-object/2
function deepClone(obj) {
	return JSON.parse(JSON.stringify(obj));
}

var nextTick;
if (typeof window == 'undefined' || window.ActiveXObject || !window.postMessage) {
	// fallback for other environments / postMessage behaves badly on IE8
	nextTick = function(fn) { setTimeout(fn, 0); };
} else {
	// https://github.com/timoxley/next-tick
    var nextTickItem = 0; // tracked outside the handler in case one of them throws
	var nextTickQueue = [];
	nextTick = function(fn) {
		if (!nextTickQueue.length) window.postMessage('nextTick', '*');
		nextTickQueue.push(fn);
	};
	window.addEventListener('message', function(evt){
		if (evt.data != 'nextTick') { return; }
		while (nextTickItem < nextTickQueue.length) {
            var i = nextTickItem; nextTickItem++;
			nextTickQueue[i]();
		}
		nextTickQueue.length = 0;
        nextTickItem = 0;
	}, true);
}

module.exports = {
	EventEmitter: EventEmitter,

	mixin: mixin,
	mixinEventEmitter: mixinEventEmitter,
	deepClone: deepClone,
	nextTick: nextTick
};
mixin.call(module.exports, DOM);
},{"./dom.js":6,"./event-emitter.js":7}],9:[function(require,module,exports){
var helpers = require('./helpers.js');
var Request = require('./request.js');
var Response = require('./response.js');

var debugLog = false;

// Bridge
// ======
// EXPORTED
// wraps a reliable, ordered messaging channel to carry messages
function Bridge(channel) {
	this.channel = channel;

	this.sidCounter = 1;
	this.incomingStreams = {}; // maps sid -> request/response stream
	// ^ only contains active streams (closed streams are deleted)
	this.outgoingStreams = {}; // like `incomingStreams`, but for requests & responses that are sending out data
	this.msgBuffer = []; // buffer of messages kept until channel is active
}
module.exports = Bridge;

// logging helper
Bridge.prototype.log = function(type) {
	var args = Array.prototype.slice.call(arguments, 1);
	console[type].apply(console, args);
};

// Sends messages that were buffered while waiting for the channel to setup
Bridge.prototype.flushBufferedMessages = function() {
	if (debugLog) { this.log('debug', 'FLUSHING MESSAGES', JSON.stringify(this.msgBuffer)); }
	this.msgBuffer.forEach(function(msg) {
		this.channel.postMessage(msg);
	}, this);
	this.msgBuffer.length = 0;
};

// Helper which buffers messages when the channel isnt ready
Bridge.prototype.send = function(msg) {
	if (this.channel.isReady === false) {
		// Buffer messages if not ready
		this.msgBuffer.push(msg);
	} else {
	    if (debugLog) { this.log('debug', 'SEND', msg); }
        if (true || !!self.window) {
		    this.channel.postMessage(msg);
        }
	}
};

// Closes any existing streams
Bridge.prototype.terminate = function(status, reason) {
	status = status || 503;
	reason = reason || 'Service Unavailable';
	for (var sid in this.incomingStreams) {
		if ((this.incomingStreams[sid] instanceof Response) && !this.incomingStreams[sid].headers.status) {
			this.incomingStreams[sid].status(status, reason);
		}
		this.incomingStreams[sid].end();
	}
	for (sid in this.outgoingStreams) {
		if ((this.outgoingStreams[sid] instanceof Response) && !this.outgoingStreams[sid].headers.status) {
			this.outgoingStreams[sid].status(status, reason);
		}
		this.outgoingStreams[sid].end();
	}
	this.incomingStreams = {};
	this.outgoingStreams = {};
	this.msgBuffer.length = 0;
	this.channel = null;
};

// Virtual request handler
Bridge.prototype.onRequest = function(ireq, ores) {
	var sid = this.sidCounter++;

	// Hold onto streams
	this.outgoingStreams[sid] = ireq;
	this.incomingStreams[-sid] = ores; // store ores stream in anticipation of the response messages

	// Send headers over the channel
	var msg = {
		sid: sid,
		method: ireq.method,
		path: ireq.path,
		params: ireq.params
	};
	for (var k in ireq) {
		if (helpers.isHeaderKey(k)) {
			msg[k] = ireq[k];
		}
	}
	this.send(JSON.stringify(msg));

	// Wire up ireq stream events
	var this2 = this;
	ireq.on('data',  function(data) { this2.send(JSON.stringify({ sid: sid, body: data })); });
	ireq.on('end', function()       { this2.send(JSON.stringify({ sid: sid, end: true })); });
	ireq.on('close', function()     {
		this2.send(JSON.stringify({ sid: sid, close: true }));
		delete this2.outgoingStreams[sid];
	});
};

// HTTPL implementation for incoming messages
Bridge.prototype.onMessage = function(msg) {
	if (debugLog) { this.log('debug', 'RECV', msg); }

	// Validate and parse JSON
	if (typeof msg == 'string') {
		if (!validateJson(msg)) {
			this.log('warn', 'Dropping malformed JSON message', msg);
			return;
		}
		msg = JSON.parse(msg);
	}
	if (!validateHttplMessage(msg)) {
		this.log('warn', 'Dropping malformed HTTPL message', msg);
		return;
	}

	// Get/create stream
	var stream = this.incomingStreams[msg.sid];
	if (!stream) {
		// Incoming responses have a negative sid
		if (msg.sid < 0) {
			// There should have been an incoming stream
			// (incoming response streams are created in onRequest)
			this.log('warn', 'Dropping unexpected HTTPL response message', msg);
			return;
		}

		// Is a new request - validate URL
		if (!msg.path) { return this.log('warn', 'Dropping HTTPL request with no path', msg); }
		msg.url = (msg.path.charAt(0) == '#') ? msg.path : ('#'+msg.path);
		delete msg.path;

		// Create request
		var oreq = new Request(msg, this.channel);
		stream = this.incomingStreams[msg.sid] = oreq;

		var this2 = this;
		var resSid = -(msg.sid);
		oreq.always(function(ires) {
			this2.outgoingStreams[resSid] = ires;

			// Send headers
			var msg = { sid: resSid, status: ires.status, reason: ires.reason };
			for (var k in ires) { if (helpers.isHeaderKey(k)) { msg[k] = ires[k]; } }
			this2.send(JSON.stringify(msg));

			// Wire response into the channel
			ires.on('data', function(data) {
				this2.send(JSON.stringify({ sid: resSid, body: data }));
			});
			ires.on('end', function() {
				this2.send(JSON.stringify({ sid: resSid, end: true }));
			});
			ires.on('close', function() {
				this2.send(JSON.stringify({ sid: resSid, close: true }));
				delete this2.outgoingStreams[resSid];
			});
		});
	}

	// Pipe received data into stream
	if (msg.sid < 0 && (stream instanceof Response) && typeof msg.status != 'undefined') {
		stream.status(msg.status, msg.reason);
		for (var k in msg) {
			if (helpers.isHeaderKey(k)) {
				stream.header(k, msg[k]);
			}
		}
		stream.start();
	}
	if (msg.body) { stream.write(msg.body); }
	if (msg.end) { stream.end(); }
	if (msg.close) {
		stream.close();
		delete this.incomingStreams[msg.sid];
	}
};

// helper used to decide if a temp worker can be ejected
Bridge.prototype.isInTransaction = function() {
	// Are we waiting on any streams?
	if (Object.keys(this.incomingStreams).length !== 0) {
		// See if any of those streams are responses
		for (var sid in this.incomingStreams) {
			if (this.incomingStreams[sid] instanceof Response && this.incomingStreams[sid].isConnOpen) {
				// not done, still receiving a response
				return true;
			}
		}
	}
    return false;
};

// This validator is faster than doing a try/catch block
// http://jsperf.com/check-json-validity-try-catch-vs-regex
function validateJson(str) {
	if (str === '') {
		return false;
	}
	str = str.replace(/\\./g, '@').replace(/"[^"\\\n\r]*"/g, '');
	return (/^[,:{}\[\]0-9.\-+Eaeflnr-u \n\r\t]*$/).test(str);
}

function validateHttplMessage(parsedmsg) {
	if (!parsedmsg)
		return false;
	if (isNaN(parsedmsg.sid))
		return false;
	return true;
}
},{"./helpers.js":11,"./request.js":16,"./response.js":17}],10:[function(require,module,exports){
// contentTypes
// ============
// EXPORTED
// provides serializers and deserializers for MIME types
var contentTypes = {
	serialize   : contentTypes__serialize,
	deserialize : contentTypes__deserialize,
	register    : contentTypes__register,
	lookup      : contentTypes__lookup
};
var contentTypes__registry = {};
module.exports = contentTypes;

// EXPORTED
// converts a simple mime alias to the full type
function contentTypes__lookup(v) {
	switch (v) {
		case 'plain':
		case 'plaintext':
		case 'text':
			return 'text/plain';
		case 'html':
			return 'text/html';
		case 'csv':
			return 'text/csv';
		case 'events':
		case 'event-stream':
			return 'text/event-stream';
		case 'json':
			return 'application/json';
		case 'xml':
			return 'application/xml';
		case 'javascript':
		case 'js':
			return 'application/javascript';
		case 'form':
		case 'urlencoded':
			return 'application/x-www-form-urlencoded';
	}
	return v;
}

// EXPORTED
// serializes an object into a string
function contentTypes__serialize(type, obj) {
	if (!obj || typeof(obj) != 'object' || !type) {
		return obj;
	}
	var fn = contentTypes__find(type, 'serializer');
	if (!fn) {
		return obj;
	}
	return fn(obj);
}

// EXPORTED
// deserializes a string into an object
function contentTypes__deserialize(type, str) {
	if (!str || typeof(str) != 'string' || !type) {
		return str;
	}
	var fn = contentTypes__find(type, 'deserializer');
	if (!fn) {
		return str;
	}
	try {
		return fn(str);
	} catch (e) {
		console.warn('Failed to deserialize content', type, str);
		return str;
	}
}

// EXPORTED
// adds a type to the registry
function contentTypes__register(type, serializer, deserializer) {
	contentTypes__registry[type] = {
		serializer   : serializer,
		deserializer : deserializer
	};
}

// INTERNAL
// takes a mimetype (text/asdf+html), puts out the applicable types ([text/asdf+html, text/html, text])
function contentTypes__mkTypesList(type) {
	var parts = type.split(';');
	var t = parts[0];
	parts = t.split('/');
	if (parts[1]) {
		var parts2 = parts[1].split('+');
		if (parts2[1]) {
			return [t, parts[0] + '/' + parts2[1], parts[0]];
		}
		return [t, parts[0]];
	}
	return [t];
}

// INTERNAL
// finds the closest-matching type in the registry and gives the request function
function contentTypes__find(type, fn) {
	var types = contentTypes__mkTypesList(type);
	for (var i=0; i < types.length; i++) {
		if (types[i] in contentTypes__registry)
			return contentTypes__registry[types[i]][fn];
	}
	return null;
}

// Default Types
// =============
contentTypes.register('application/json',
	function (obj) {
		try {
			return JSON.stringify(obj);
		} catch (e) {
			return e.message;
		}
	},
	function (str) {
		try {
			return JSON.parse(str);
		} catch (e) {
			return e.message;
		}
	}
);
contentTypes.register('application/x-www-form-urlencoded',
	function (obj) {
		var enc = encodeURIComponent;
		var str = [];
		for (var k in obj) {
			if (obj[k] === null) {
				str.push(k+'=');
			} else if (Array.isArray(obj[k])) {
				for (var i=0; i < obj[k].length; i++) {
					str.push(k+'[]='+enc(obj[k][i]));
				}
			} else if (typeof obj[k] == 'object') {
				for (var k2 in obj[k]) {
					str.push(k+'['+k2+']='+enc(obj[k][k2]));
				}
			} else {
				str.push(k+'='+enc(obj[k]));
			}
		}
		return str.join('&');
	},
	function (params) {
		// thanks to Brian Donovan
		// http://stackoverflow.com/a/4672120
		var pairs = params.split('&'),
		result = {};

		for (var i = 0; i < pairs.length; i++) {
			var pair = pairs[i].split('='),
			key = decodeURIComponent(pair[0]),
			value = decodeURIComponent(pair[1]),
			isArray = /\[\]$/.test(key),
			dictMatch = key.match(/^(.+)\[([^\]]+)\]$/);

			// try to match the value to a bool or number type, if appropriate
			if (value === 'true') value = true;
			else if (value === 'false') value = false;
			else if (+value == value) value = +value;

			if (dictMatch) {
				key = dictMatch[1];
				var subkey = dictMatch[2];

				result[key] = result[key] || {};
				result[key][subkey] = value;
			} else if (isArray) {
				key = key.substring(0, key.length-2);
				result[key] = result[key] || [];
				result[key].push(value);
			} else {
				result[key] = value;
			}
		}

		return result;
	}
);
contentTypes.register('text/event-stream',
	function (obj) {
		var str = '';
		if (typeof obj.event != 'undefined')
			str += 'event: '+obj.event+'\r\n';
		if (typeof obj.data != 'undefined')
			str += 'data: '+JSON.stringify(obj.data)+'\r\n';
		return str + '\r\n';
	},
	function (str) {
		var m = {};
		str.split("\r\n").forEach(function(kv) {
			if (/^[\s]*$/.test(kv))
				return;
			kv = splitEventstreamKV(kv);
			if (!kv[0]) return; // comment lines have nothing before the colon
			m[kv[0]] = kv[1];
		});
		if (m.data) {
			try { m.data = JSON.parse(m.data); }
			catch(e) {}
		}
		return m;
	}
);
function splitEventstreamKV(kv) {
	var i = kv.indexOf(':');
	return [kv.slice(0, i).trim(), kv.slice(i+1).trim()];
}
},{}],11:[function(require,module,exports){
// Helpers
// =======

var promise = require('../promises.js').promise;
var contentTypes = require('./content-types.js');
var UriTemplate = require('./uri-template.js');

// EXPORTED
// takes a document and produces link objects for all requested element types
// - `doc`: Document, usually there's only one anyway
// - `opts.links`: bool, get <link> elements (default true)
// - `opts.anchors`: bool, get <a> elements (default false)
function extractDocumentLinks(doc, opts) {
	if (!opts) { opts = {}; }
	if (typeof opts.links == 'undefined') { opts.links = true; }

	var els = [];
	if (opts.links)   { els = els.concat(Array.prototype.slice.call(doc.querySelectorAll('link'))); }
	if (opts.anchors) { els = els.concat(Array.prototype.slice.call(doc.querySelectorAll('a'))); }
	return els.map(function(el) {
		var link = {};
		for (var i=0; i < el.attributes.length; i++) {
			link[el.attributes[i].name] = el.attributes[i].value;
		}
		return link;
	});
}

// EXPORTED
// takes parsed a link header and a query object, produces an array of matching links
// - `links`: [object]/object/Document, either the parsed array of links, the request/response object, or a Document
// - `query`: object/string
var __docexists = (typeof Document != 'undefined');
function queryLinks(links, query) {
	if (!links) return [];
	if (__docexists && links instanceof Document) links = extractDocumentLinks(links); // actually the document
	if (links.parsedHeaders) links = links.parsedHeaders.link; // actually a request or response object
	if (typeof query == 'string') { query = { rel: query }; } // if just a string, test against reltype
	if (!Array.isArray(links)) return [];
	return links.filter(function(link) { return queryLink(link, query); });
}

// EXPORTED
// takes parsed link and a query object, produces boolean `isMatch`
// - `query`: object, keys are attributes to test, values are values to test against (strings)
//            eg { rel: 'foo bar', id: 'x' }
//            string, the reltype to test against
// - Query rules
//   - if a query attribute is present on the link, but does not match, returns false
//   - if a query attribute is not present on the link, and is not present in the href as a URI Template token, returns false
//   - otherwise, returns true
//   - query values preceded by an exclamation-point (!) will invert (logical NOT)
//   - query values may be a function which receive (value, key) and return true if matching
//   - rel: can take multiple values, space-separated, which are ANDed logically
//   - rel: will ignore the preceding scheme and trailing slash on URI values
//   - rel: items preceded by an exclamation-point (!) will invert (logical NOT)
var uriTokenStart = '\\{([^\\}]*)[\\+\\#\\.\\/\\;\\?\\&]?';
var uriTokenEnd = '(\\,|\\})';
function queryLink(link, query) {
	if (typeof query == 'string') { query = { rel: query }; } // if just a string, test against reltype
	for (var attr in query) {
		if (typeof query[attr] == 'function') {
			if (!query[attr].call(null, link[attr], attr)) {
				return false;
			}
		} else if (attr == 'rel') {
			var terms = query.rel.split(/\s+/);
			for (var i=0; i < terms.length; i++) {
				var desiredBool = true;
				if (terms[i].charAt(0) == '!') {
					terms[i] = terms[i].slice(1);
					desiredBool = false;
				}
				if (RegExp('(\\s|^)(.*//)?'+terms[i]+'(\\s|$)', 'i').test(link.rel) !== desiredBool)
					return false;
			}
		}
		else {
			if (typeof link[attr] == 'undefined') {
				// Attribute not explicitly set -- is it present in the href as a URI token?
				if (RegExp(uriTokenStart+attr+uriTokenEnd,'i').test(link.href) === true)
					continue;
				// Is the test value not falsey?
				if (!!query[attr])
					return false; // specific value needed
			}
			else {
				if (query[attr] && query[attr].indexOf && query[attr].indexOf('!') === 0) { // negation
					if (link[attr] == query[attr].slice(1))
						return false;
				} else {
					if (link[attr] != query[attr])
						return false;
				}
			}
		}
	}
	return true;
}

// <https://github.com/federomero/negotiator>
// thanks to ^ for the content negotation helpers below
// INTERNAL
function getMediaTypePriority(type, accepted) {
	var matches = accepted
		.filter(function(a) { return specify(type, a); })
		.sort(function (a, b) { return a.q > b.q ? -1 : 1; }); // revsort
	return matches[0] ? matches[0].q : 0;
}
// INTERNAL
function specifies(spec, type) {
	return spec === '*' || spec === type;
}
// INTERNAL
function specify(type, spec) {
	var p = parseMediaType(type);

	if (spec.params) {
		var keys = Object.keys(spec.params);
		if (keys.some(function (k) { return !specifies(spec.params[k], p.params[k]); })) {
			// some didn't specify.
			return null;
		}
	}

	if (specifies(spec.type, p.type) && specifies(spec.subtype, p.subtype)) {
		return spec;
	}
}

// EXPORTED
// thanks to https://github.com/federomero/negotiator
function parseMediaType(s) {
	var match = s.match(/\s*(\S+)\/([^;\s]+)\s*(?:;(.*))?/);
	if (!match) return null;

	var type = match[1];
	var subtype = match[2];
	var full = "" + type + "/" + subtype;
	var params = {}, q = 1;

	if (match[3]) {
		params = match[3].split(';')
			.map(function(s) { return s.trim().split('='); })
			.reduce(function (set, p) { set[p[0]] = p[1]; return set; }, params);

		if (params.q !== null) {
			q = parseFloat(params.q);
			delete params.q;
		}
	}

	return {
		type: type,
		subtype: subtype,
		params: params,
		q: q,
		full: full
	};
}

function parseAcceptHeader(str) {
	return str.split(',')
		.map(function(e) { return parseMediaType(e.trim()); })
		.filter(function(e) { return e && e.q > 0; });
}

// EXPORTED
// returns an array of preferred media types ordered by priority from a list of available media types
// - `accept`: string/object, given accept header or request object
// - `provided`: optional [string], allowed media types
function preferredTypes(accept, provided) {
	if (typeof accept == 'object') {
		accept = accept.headers.accept;
	}
	accept = parseAcceptHeader(accept || '');
	if (provided) {
		if (!Array.isArray(provided)) {
			provided = [provided];
		}

		return provided
			.map(function(type) {
				type = contentTypes.lookup(type); // run mimetype aliases
				return [type, getMediaTypePriority(type, accept)];
			})
			.filter(function(pair) { return pair[1] > 0; })
			.sort(function(a, b) { return a[1] === b[1] ? 0 : a[1] > b[1] ? -1 : 1; }) // revsort
			.map(function(pair) { return pair[0]; });
	}
	return accept.map(function(type) { return type.full; });
}

// EXPORTED
// returns the top preferred media type from a list of available media types
// - `accept`: string/object, given accept header or request object
// - `provided`: optional [string], allowed media types
function preferredType(accept, provided) {
	return preferredTypes(accept, provided)[0];
}
// </https://github.com/federomero/negotiator>

// EXPORTED
// correctly joins together all url segments given in the arguments
// eg joinUri('/foo/', '/bar', '/baz/') -> '/foo/bar/baz/'
function joinUri() {
	var parts = Array.prototype.map.call(arguments, function(arg, i) {
		arg = ''+arg;
		var lo = 0, hi = arg.length;
		if (arg == '/') return '';
		if (i !== 0 && arg.charAt(0) === '/') { lo += 1; }
		if (arg.charAt(hi - 1) === '/') { hi -= 1; }
		return arg.substring(lo, hi);
	});
	return parts.join('/');
}

// EXPORTED
// tests to see if a URL is absolute
// - "absolute" means that the URL can reach something without additional context
// - eg http://foo.com, //foo.com, #bar.app
var hasSchemeRegex = /^(#)|((http(s|l)?:)?\/\/)|((nav:)?\|\|)|(data:)/;
function isAbsUri(url) {
	// Has a scheme?
	return hasSchemeRegex.test(url);
}

// EXPORTED
// tests to see if a URL is using the nav scheme
var isNavSchemeUriRE = /^(nav:)?\|?\|/i;
function isNavSchemeUri(v) {
	return isNavSchemeUriRE.test(v);
}


// EXPORTED
// takes a context url and a relative path and forms a new valid url
// eg joinRelPath('http://grimwire.com/foo/bar', '../fuz/bar') -> 'http://grimwire.com/foo/fuz/bar'
function joinRelPath(urld, relpath) {
	if (typeof urld == 'string') {
		urld = parseUri(urld);
	}
	var protocol = (urld.protocol) ? urld.protocol + '://' : false;
	if (!protocol) {
		if (urld.source.indexOf('//') === 0) {
			protocol = '//';
		} else if (urld.source.indexOf('||') === 0) {
			protocol = '||';
		} else {
			protocol = 'http://';
		}
	}
	if (relpath.charAt(0) == '/') {
		// "absolute" relative, easy stuff
		return protocol + urld.authority + relpath;
	}
	// totally relative, oh god
	// (thanks to geoff parker for this)
	var hostpath = urld.path;
	var hostpathParts = hostpath.split('/');
	var relpathParts = relpath.split('/');
	for (var i=0, ii=relpathParts.length; i < ii; i++) {
		if (relpathParts[i] == '.')
			continue; // noop
		if (relpathParts[i] == '..')
			hostpathParts.pop();
		else
			hostpathParts.push(relpathParts[i]);
	}
	return joinUri(protocol + urld.authority, hostpathParts.join('/'));
}

// EXPORTED
// parseUri 1.2.2, (c) Steven Levithan <stevenlevithan.com>, MIT License
function parseUri(str) {
	if (typeof str === 'object') {
		if (str.url) { str = str.url; }
		else if ((str.headers && str.headers.host) || str.path) { str = joinUri(str.headers.host, str.path); }
	}

	// handle data-uris specially
	if (str.slice(0,5) == 'data:') {
		return { protocol: 'data', source: str };
	}
	var	o   = parseUri.options,
		m   = o.parser[o.strictMode ? "strict" : "loose"].exec(str),
		uri = {},
		i   = 15;

	while (i--) uri[o.key[i]] = m[i] || "";

	uri[o.q.name] = {};
	uri[o.key[13]].replace(o.q.parser, function ($0, $1, $2) {
		if ($1) uri[o.q.name][$1] = $2;
	});

	return uri;
}

parseUri.options = {
	strictMode: false,
	key: ["source","protocol","authority","userInfo","user","password","host","port","srcPath","relative","path","directory","file","query","anchor"],
	q:   {
		name:   "queryKey",
		parser: /(?:^|&)([^&=]*)=?([^&]*)/g
	},
	parser: {
		strict: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@\/]*)(?::([^:@\/]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,
		loose:  /^(?:(?![^:@\/]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@\/]*)(?::([^:@\/]*))?)?@)?([^:\/\(?#]*)(?::(\d*))?(?:\(([^\)]+)\))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/
	//             -------------------------------------   ------   ----------------------------------------------------------------------------  ===================================relative=============================================
	//                --------------------  ==scheme==               --------------------------------   ====host===  --------   --------------     ======================path===================================  -----------   -------
	//                                                                  ========userInfo========                         ===         ======         ===================directory====================   ==file==        =====        ==
	//                                                                   ==user==   -----------                      port^    srcPath^                 ----------------------------------------                   query^      anchor^
	//                                                                                 ==pass=                                                                 -------------------------------
	//                                                                                                                                                                                -------
	}
};

// EXPORTED
// Converts a 'nav:' URI into an array of http/s/l URIs and link query objects
function parseNavUri(str) {
	if (!str) return [];

	// Check (and strip out) scheme
	var schemeIndex = str.indexOf('||');
	if (schemeIndex !== -1) {
		str = str.slice(schemeIndex+2);
	}

	// Split into navigations
	var parts = str.split('|');

	// Parse queries
	// eg ...|rel=id,attr1=value1,attr2=value2|...
	for (var i=1; i < parts.length; i++) {
		var query = {};
		var attrs = parts[i].split(',');
		for (var j=0; j < attrs.length; j++) {
			var kv = attrs[j].split('=');
			if (j === 0) {
				query.rel = kv[0].replace(/\+/g, ' ');
				if (kv[1])
					query.id = kv[1];
			} else
				query[kv[0]] = decodeURIComponent(kv[1]).replace(/\+/g, ' ');
		}
		parts[i] = query;
	}

	// Limit to 5 navigations (and 1 base)
	if (parts.length > 6)
		parts.length = 6;

	// Drop first entry if empty (a relative nav uri)
	if (!parts[0])
		parts.shift();

	return parts;
}

// EXPORTED
// builds a proxy URI out of an array of templates
// eg ('local://my_worker.js/', ['local://0.env/{uri}', 'local://foo/{?uri}'])
// -> "local://0.env/local%3A%2F%2Ffoo%2F%3Furi%3Dhttpl%253A%252F%252Fmy_worker.js%252F"
function makeProxyUri(uri, templates) {
	if (!Array.isArray(templates)) templates = [templates];
	for (var i=templates.length-1; i >= 0; i--) {
		var tmpl = templates[i];
		uri = UriTemplate.parse(tmpl).expand({ uri: uri });
	}
	return uri;
}

// EXPORTED
// identifiers a string as a header key
// - 'FooBar' -> true
// - 'foo' -> false
// - 'foo-bar' -> false
var ucRegEx = /^[A-Z]/;
function isHeaderKey(k) {
	return ucRegEx.test(k);
}

// :TODO:
// EXPORTED
// modifies XMLHttpRequest to support HTTPL
/*function patchXHR() {
	// Store references to original methods
	var orgXHR = XMLHttpRequest;
	var orgPrototype = XMLHttpRequest.prototype;
	function localXMLHttpRequest() {}
	(window || self).XMLHttpRequest = localXMLHttpRequest;
	localXMLHttpRequest.UNSENT = 0;
	localXMLHttpRequest.OPENED = 1;
	localXMLHttpRequest.HEADERS_RECEIVED = 2;
	localXMLHttpRequest.LOADING = 4;
	localXMLHttpRequest.DONE = 4;

	localXMLHttpRequest.prototype.open = function(method, url, async, user, password) {
		// Is HTTPL?
		var urld = parseUri(url);
		if (urld.protocol != 'httpl' && urld.protocol != 'local') {
			Object.defineProperty(this, '__xhr_request', { value: new orgXHR() });
			return this.__xhr_request.open(method, url, async, user, password);
		}

		// Construct request
		var Request = require('./request.js');
		Object.defineProperty(this, '__local_request', { value: new Request({ method: method, url: url, stream: true }) });
		if (user) {
			this.__local_request.setHeader('Authorization', 'Basic '+btoa(user+':'+password));
		}

		// Update state
		this.readyState = 1;
		if (this.onreadystatechange) {
			this.onreadystatechange();
		}
	};

	localXMLHttpRequest.prototype.send = function(data) {
		var this2 = this;
		if (this.__local_request) {
			// Dispatch and send data
			var res_ = require('./dispatch.js').dispatch(this.__local_request);
			this.__local_request.end(data);

			// Wire up events
			res_.always(function(res) {
				Object.defineProperty(this2, '__local_response', { value: res });
				// Update state
				this2.readyState = 2;
				this2.status = res.status;
				this2.statusText = res.status + ' ' + res.reason;
				this2.responseText = null;
				// Fire event
				if (this2.onreadystatechange) {
					this2.onreadystatechange();
				}
				res.on('data', function(chunk) {
					this2.readyState = 3;
					if (this2.responseText === null && typeof chunk == 'string') this2.responseText = '';
					this2.responseText += chunk;
					// Fire event
					if (this2.onreadystatechange) {
						this2.onreadystatechange();
					}
				});
				res.on('end', function() {
					this2.readyState = 4;
					switch (this2.responseType) {
						case 'json':
							this2.response = res.body;
							break;

						case 'text':
						default:
							this2.response = this2.responseText;
							break;
					}
					// Fire event
					if (this2.onreadystatechange) {
						this2.onreadystatechange();
					}
					if (this2.onload) {
						this2.onload();
					}
				});
			});
		} else {
			// Copy over any attributes we've been given
			this.__xhr_request.onreadystatechange = function() {
				for (var k in this) {
					if (typeof this[k] == 'function') continue;
					this2[k] = this[k];
				}
				if (this2.onreadystatechange) {
					this2.onreadystatechange();
				}
			};
			return this.__xhr_request.send(data);
		}
	};

	localXMLHttpRequest.prototype.abort = function() {
		if (this.__local_request) {
			return this.__local_request.close();
		} else {
			return this.__xhr_request.abort();
		}
	};

	localXMLHttpRequest.prototype.setRequestHeader = function(k, v) {
		if (this.__local_request) {
			return this.__local_request.setHeader(k.toLowerCase(), v);
		} else {
			return this.__xhr_request.setRequestHeader(k, v);
		}
	};

	localXMLHttpRequest.prototype.getAllResponseHeaders = function(k) {
		if (this.__local_request) {
			return this.__local_response ? this.__local_response.headers : null;
		} else {
			return this.__xhr_request.getAllResponseHeaders(k);
		}
	};

	localXMLHttpRequest.prototype.getResponseHeader = function(k) {
		if (this.__local_request) {
			return this.__local_response ? this.__local_response.getHeader(k) : null;
		} else {
			return this.__xhr_request.getResponseHeader(k);
		}
	};
}*/

module.exports = {
	extractDocumentLinks: extractDocumentLinks,
	queryLinks: queryLinks,
	queryLink: queryLink,

	preferredTypes: preferredTypes,
	preferredType: preferredType,
	parseMediaType: parseMediaType,
	parseAcceptHeader: parseAcceptHeader,

	joinUri: joinUri,
	joinRelPath: joinRelPath,

	isAbsUri: isAbsUri,
	isNavSchemeUri: isNavSchemeUri,

	parseUri: parseUri,
	parseNavUri: parseNavUri,
	makeProxyUri: makeProxyUri,

	isHeaderKey: isHeaderKey,

	// patchXHR: patchXHR :TODO:
};
},{"../promises.js":4,"./content-types.js":10,"./uri-template.js":19}],12:[function(require,module,exports){
var helpers = require('./helpers.js');

// headers
// =======
// EXPORTED
// provides serializers and deserializers for HTTP headers
var httpHeaders = {
	serialize   : httpheaders__serialize,
	deserialize : httpheaders__deserialize,
	register    : httpheaders__register
};
var httpheaders__registry = {};
module.exports = httpHeaders;

// EXPORTED
// serializes an object into a string
function httpheaders__serialize(header, obj) {
	if (!obj || typeof(obj) != 'object' || !header) {
		return obj;
	}
	var fn = httpheaders__find(header, 'serializer');
	if (!fn) {
		return obj;
	}
	try {
		return fn(obj);
	} catch (e) {
		console.warn('Failed to serialize header', header, obj);
		return obj;
	}
}

// EXPORTED
// deserializes a string into an object
function httpheaders__deserialize(header, str) {
	if (!str || typeof(str) != 'string' || !header) {
		return str;
	}
	var fn = httpheaders__find(header, 'deserializer');
	if (!fn) {
		return str;
	}
	try {
		return fn(str);
	} catch (e) {
		console.warn('Failed to deserialize header', header, str);
		return str;
	}
}

// EXPORTED
// adds a header to the registry
function httpheaders__register(header, serializer, deserializer) {
	httpheaders__registry[header.toLowerCase()] = {
		serializer   : serializer,
		deserializer : deserializer
	};
}

// INTERNAL
// finds the header's de/serialization functions
function httpheaders__find(header, fn) {
	var headerFns = httpheaders__registry[header.toLowerCase()];
	if (headerFns) {
		return headerFns[fn];
	}
	return null;
}

// Default Headers
// ===============

//                                KV params
//                  "</foo>"  "; "    \/   ", <" or eol
//                   ------- -------- ---  ----------------
var linkHeaderRE1 = /<(.*?)>(?:;[\s]*(.*?)((,(?=[\s]*<))|$))/g;
//                        "key"     "="      \""val\""    "val"
//                    -------------- -       ---------   -------
var linkHeaderRE2 = /([\-a-z0-9_\.]+)=?(?:(?:"([^"]+)")|([^;\s]+))?/g;
httpHeaders.register('link',
	function (obj) {
		var links = [];
		obj.forEach(function(link) {
			var linkParts = ['<'+link.href+'>'];
			for (var attr in link) {
				if (attr == 'href') {
					continue;
				}
				if (link[attr] === null) {
					continue;
				}
				if (typeof link[attr] == 'boolean' && link[attr]) {
					linkParts.push(attr);
				} else {
					linkParts.push(attr+'="'+link[attr]+'"');
				}
			}
			links.push(linkParts.join('; '));
		});
		return links.join(', ');
	},
	function (str) {
		var links = [], linkParse1, linkParse2, link;
		// '</foo/bar>; rel="baz"; id="blah", </foo/bar>; rel="baz"; id="blah", </foo/bar>; rel="baz"; id="blah"'
		// Extract individual links
		while ((linkParse1 = linkHeaderRE1.exec(str))) { // Splits into href [1] and params [2]
			link = { href: linkParse1[1] };
			// 'rel="baz"; id="blah"'
			// Extract individual params
			while ((linkParse2 = linkHeaderRE2.exec(linkParse1[2]))) { // Splits into key [1] and value [2]/[3]
				link[linkParse2[1]] = linkParse2[2] || linkParse2[3] || true; // if no parameter value is given, just set to true
			}
			links.push(link);
		}
		return links;
	}
);

httpHeaders.register('accept',
	function (obj) {
		return obj.map(function(type) {
			var parts = [type.full];
			if (type.q !== 1) {
				parts.push('q='+type.q);
			}
			for (var k in type.params) {
				parts.push(k+'='+type.params[k]);
			}
			return parts.join('; ');
		}).join(', ');
	},
	helpers.parseAcceptHeader
);
},{"./helpers.js":11}],13:[function(require,module,exports){
var helpers = require('./helpers.js');
var schemes = require('./schemes.js');
var contentTypes = require('./content-types.js');
var IncomingRequest = require('./incoming-request.js');
var Response = require('./response.js');
var workers = require('./workers.js');

// Local Routes Registry
// =====================
var _routes = [];

// EXPORTED
function at(path, handler) {
	if (path.charAt(0) != '#') {
		path = '#' + path;
	}
	path = new RegExp('^('+path+')$', 'i');
	_routes.push({ path: path, handler: handler });
}

// EXPORTED
function getRoutes() {
	return _routes;
}

// Virtual request handler
schemes.register('#', function (oreq, ires) {
	// Parse the virtual path
	var urld2 = local.parseUri('/' + (oreq.urld.anchor || ''));
	if (urld2.query) {
		// mix query params into request
		var queryParams = local.contentTypes.deserialize('application/x-www-form-urlencoded', urld2.query);
		oreq.param(queryParams);
	}
	oreq.headers.path = '#' + urld2.path.slice(1);

	// Get the handler
	var handler;
	// Is a host URL given?
	if (oreq.urld.path) {
		// Try to get/load the VM
		handler = workers.getWorker(oreq.urld);
	} else {
		// Match the route in the current page
		var pathd;
		for (var i=0; i < _routes.length; i++) {
			pathd = _routes[i].path.exec(oreq.headers.path);
			if (pathd) {
				handler = _routes[i].handler;
				break;
			}
		}
		oreq.headers.pathd = pathd;
	}

	// Create incoming request / outgoing response
	var ireq = new IncomingRequest(oreq.headers);
	var ores = new Response();

	// Wire up events
	oreq.wireUp(ireq);
	ores.wireUp(ires);
    ireq.memoEventsTillNextTick();
    ires.memoEventsTillNextTick();
	oreq.on('close', function() { ores.close(); });

	// Support warnings
	if (oreq.isBinary) // :TODO: add support
		console.warn('Got virtual request with binary=true - sorry, not currently supported', oreq);

	// Pass on to the handler
	if (handler) {
		handler(ireq, ores, oreq.originChannel);
	} else {
		ores.s404().end();
	}
});

module.exports = {
	at: at,
	getRoutes: getRoutes
};
},{"./content-types.js":10,"./helpers.js":11,"./incoming-request.js":14,"./response.js":17,"./schemes.js":18,"./workers.js":20}],14:[function(require,module,exports){
var util = require('../util');
var helpers = require('./helpers.js');
var httpHeaders = require('./http-headers.js');
var contentTypes = require('./content-types.js');

// IncomingRequest
// ===============
// EXPORTED
// Interface for receiving requests (used in virtual servers)
function IncomingRequest(headers) {
	util.EventEmitter.call(this);
	var this2 = this;
	var hidden = function(k, v) { Object.defineProperty(this2, k, { value: v, writable: true }); };

	// Set attributes
	this.method = (headers.method) ? headers.method.toUpperCase() : 'GET';
	this[this.method] = true;
	this.path = headers.path || '#';
	this.params = (headers.params) || {};
	this.isBinary = false; // stream is binary? :TODO:
	for (var k in headers) {
		if (helpers.isHeaderKey(k)) { // starts uppercase?
			// Is a header, save
			this[k] = headers[k];

			// Try to parse
			var parsedHeader = httpHeaders.deserialize(k, headers[k]);
			if (parsedHeader && typeof parsedHeader != 'string') {
				this[k.toLowerCase()] = parsedHeader;
			}
		}
	}

	// Stream state
	hidden('isConnOpen', true);
	hidden('isStarted', true);
	hidden('isEnded', false);
	this.on('end', function() { this2.isEnded = true; });
}
IncomingRequest.prototype = Object.create(util.EventEmitter.prototype);
module.exports = IncomingRequest;

// Stream buffering
// stores the incoming stream and attempts to parse on end
IncomingRequest.prototype.buffer = function(cb) {
	// setup buffering
	if (typeof this._buffer == 'undefined') {
		var this2 = this;
		this._buffer = '';
		this.body = null;
		this.on('data', function(data) {
			if (typeof data == 'string') {
				this2._buffer += data;
			} else {
				this2._buffer = data; // Assume it is an array buffer or some such
			}
		});
		this.on('end', function() {
			if (this2.ContentType)
				this2.body = contentTypes.deserialize(this2.ContentType, this2._buffer);
			else
				this2.body = this2._buffer;
		});
	}
	this.on('end', cb);
};

// Pipe helper
// streams the incoming request  into an outgoing request or response
// - doesnt overwrite any previously-set headers
// - params:
//   - `target`: the outgoing request or response to push data to
//   - `headersCb`: (optional) takes `(k, v)` from source and responds updated header for otarget
//   - `bodyCb`: (optional) takes `(body)` from source and responds updated body for otarget
IncomingRequest.prototype.pipe = function(target, headersCB, bodyCb) {
	headersCB = headersCB || function(v) { return v; };
	bodyCb = bodyCb || function(v) { return v; };
	if (target instanceof require('./request')) {
		if (!target.headers.method) {
			target.headers.method = this.method;
		}
		if (!target.headers.url) {
			target.headers.url = this.url;
		}
		for (var k in this) {
			if (helpers.isHeaderKey(k)) {
				target.header(k, headersCB(k, this[k]));
			}
		}
	} else if (target instanceof require('./response')) {
		if (!target.headers.ContentType && this.ContentType) {
			target.ContentType(this.ContentType);
		}
	}
	if (this.isEnded) {
		// send body (if it was buffered)
		target.end(bodyCb(this.body));
	} else {
		// wire up the stream
		this.on('data', function(chunk) { target.write(bodyCb(chunk)); });
		this.on('end', function() { target.end(); });
	}
};
},{"../util":8,"./content-types.js":10,"./helpers.js":11,"./http-headers.js":12,"./request":16,"./response":17}],15:[function(require,module,exports){
var util = require('../util');
var helpers = require('./helpers.js');
var httpHeaders = require('./http-headers.js');
var contentTypes = require('./content-types.js');

// IncomingResponse
// ================
// EXPORTED
// Interface for receiving responses
function IncomingResponse() {
	util.EventEmitter.call(this);
	var this2 = this;
	var hidden = function(k, v) { Object.defineProperty(this2, k, { value: v, writable: true }); };

	// Set attributes
	this.status = 0;
	this.reason = undefined;
	hidden('latency', undefined);

	// Stream state
	hidden('isConnOpen', true);
	hidden('isStarted', true);
	hidden('isEnded', false);
	this.on('end', function() { this2.isEnded = true; });
}
IncomingResponse.prototype = Object.create(util.EventEmitter.prototype);
module.exports = IncomingResponse;

// Parses headers, makes sure response header links are absolute
IncomingResponse.prototype.processHeaders = function(oreq, headers) {
	this.status = headers.status;
	this.reason = headers.reason;

	// Parse headers
	for (var k in headers) {
		if (helpers.isHeaderKey(k)) {
			// Is a header, save
			this[k] = headers[k];

			// Try to parse
			var parsedHeader = httpHeaders.deserialize(k, headers[k]);
			if (parsedHeader && typeof parsedHeader != 'string') {
				this[k.toLowerCase()] = parsedHeader;
			}
		}
	}

	// Update the link headers
	if (this.link) {
		this.links = this.link;
		delete this.link;
		this.links.forEach(function(link) {
			// Convert relative paths to absolute uris
			if (!helpers.isAbsUri(link.href)) {
				if (oreq.isVirtual) {
					link.href = '#'+link.href;
				} else {
					link.href = helpers.joinRelPath(oreq.urld, link.href);
				}
			}
		});
	}
};

// Stream buffering
// stores the incoming stream and attempts to parse on end
IncomingResponse.prototype.buffer = function(cb) {
	// setup buffering
	if (typeof this._buffer == 'undefined') {
		var this2 = this;
		this._buffer = '';
		this.body = null;
		this.on('data', function(data) {
			if (typeof data == 'string') {
				this2._buffer += data;
			} else {
				this2._buffer = data; // Assume it is an array buffer or some such
			}
		});
		this.on('end', function() {
			if (this2.ContentType)
				this2.body = contentTypes.deserialize(this2.ContentType, this2._buffer);
			else
				this2.body = this2._buffer;
		});
	}
	this.on('end', cb);
};

// Pipe helper
// streams the incoming resposne into an outgoing request or response
// - doesnt overwrite any previously-set headers
// - params:
//   - `target`: the incoming request or response to pull data from
//   - `headersCb`: (optional) takes `(k, v)` from source and responds updated header for target
//   - `bodyCb`: (optional) takes `(body)` from source and responds updated body for target
IncomingResponse.prototype.pipe = function(target, headersCB, bodyCb) {
	headersCB = headersCB || function(v) { return v; };
	bodyCb = bodyCb || function(v) { return v; };
	if (target instanceof require('./response')) {
		if (!target.headers.status) {
			target.status(this.status, this.reason);
		}
		for (var k in this) {
			if (helpers.isHeaderKey(k)) {
				target.header(k, headersCB(k, this[k]));
			}
		}
	} else if (target instanceof require('./request')) {
		if (!target.headers.ContentType && this.ContentType) {
			target.ContentType(this.ContentType);
		}
	}
	if (this.isEnded) {
		// send body (if it was buffered)
		target.end(bodyCb(this.body));
	} else {
		// wire up the stream
		this.on('data', function(chunk) { target.write(bodyCb(chunk)); });
		this.on('end', function() { target.end(); });
	}
};
},{"../util":8,"./content-types.js":10,"./helpers.js":11,"./http-headers.js":12,"./request":16,"./response":17}],16:[function(require,module,exports){
var util = require('../util');
var promises = require('../promises.js');
var helpers = require('./helpers.js');
var schemes = require('./schemes.js');
var contentTypes = require('./content-types.js');
var IncomingResponse = require('./incoming-response.js');

// Request
// =======
// EXPORTED
// Interface for sending requests
function Request(headers, originChannel) {
	util.EventEmitter.call(this);
	promises.Promise.call(this);
	if (!headers) headers = {};
	if (typeof headers == 'string') headers = { url: headers };

	// Request definition
	// headers is an object containing method, url, params (the query params) and the header values (as uppercased keys)
	this.headers = headers;
	this.headers.method = (this.headers.method) ? this.headers.method.toUpperCase() : 'GET';
	this.headers.params = (this.headers.params) || {};
	this.originChannel = originChannel;
	this.isBinary = false; // stream is binary?
	this.isVirtual = undefined; // request going to virtual host?
	this.isBufferingResponse = false; // auto-buffering the response?

	// Stream state
	this.isConnOpen = true;
	this.isStarted = false;
	this.isEnded = false;
}
Request.prototype = Object.create(util.EventEmitter.prototype);
util.mixin.call(Request.prototype, promises.Promise.prototype);
module.exports = Request;

// Header setter
Request.prototype.header = function(k, v) {
	k = formatHeaderKey(k);
	// Convert mime if needed
	if (k == 'Accept' || k == 'ContentType') {
		v = contentTypes.lookup(v);
	}
	this.headers[k] = v;
	return this;
};

// Header sugars
[ 'Accept', 'Authorization', 'ContentType', 'Expect', 'From', 'Pragma' ].forEach(function(k) {
	Request.prototype[k] = function(v) {
		return this.header(k, v);
	};
});

// helper to convert a given header value to our standard format - camel case, no dashes
var headerKeyRegex = /(^|-)(.)/g;
function formatHeaderKey(str) {
	// strip any dashes, convert to camelcase
	// eg 'foo-bar' -> 'FooBar'
	return str.replace(headerKeyRegex, function(_0,_1,_2) { return _2.toUpperCase(); });
}

// Param setter
// - `k` may be an object of keys to add
// - or `k` can be the keyname and `v` the value
// - eg: req.param({ foo: 'bar', hot: 'dog' })
//       req.param('foo', 'bar').param('hot', 'dog')
Request.prototype.param = function(k, v) {
	if (k && typeof k == 'object') {
		for (var k2 in k) {
			this.param(k2, k[k2]);
		}
	} else {
		this.headers.params[k] = v;
	}
	return this;
};

// Request timeout setter
// causes the request/response to abort after the given milliseconds
Request.prototype.setTimeout = function(ms) {
	var self = this;
	if (this.__timeoutId) return;
	this.__timeoutId = setTimeout(function() {
		if (self.isConnOpen) { self.close(); }
		delete self.__timeoutId;
	}, ms);
	return this;
};

// Binary mode
// causes the request and response to use binary
// - if no bool is given, sets binary-mode to true
Request.prototype.setBinary = function(v) {
	if (typeof v == 'boolean') {
		this.isBinary = v;
	} else {
		this.isBinary = true;
	}
	return this;
};

// Virtual mode
// forces the request to go to a virtual host (or not)
// - if no bool is given, sets virtual-mode to true
Request.prototype.setVirtual = function(v) {
	if (typeof v == 'boolean') {
		this.isVirtual = v;
	} else {
		this.isVirtual = true;
	}
	return this;
};

// Response buffering
// instructs the request to auto-buffer the response body and set it to `res.body`
Request.prototype.bufferResponse = function(v) {
	if (typeof v == 'boolean') {
		this.isBufferingResponse = v;
	} else {
		this.isBufferingResponse = true;
	}
	return this;
};

// Pipe helper
// passes through to its incoming response
Request.prototype.pipe = function(target, headersCb, bodyCb) {
	this.always(function(res) { res.pipe(target, headersCb, bodyCb); });
};

// Event connection helper
// connects events from this stream to the target (event proxying)
Request.prototype.wireUp = function(other, async) {
	if (async) {
		var nextTick = function(fn) { return function(value) { util.nextTick(fn.bind(null, value)); }; };
		this.once('headers', nextTick(other.emit.bind(other, 'headers')));
		this.on('data', nextTick(other.emit.bind(other, 'data')));
		this.once('end', nextTick(other.emit.bind(other, 'end')));
	} else {
		this.once('headers', other.emit.bind(other, 'headers'));
		this.on('data', other.emit.bind(other, 'data'));
		this.once('end', other.emit.bind(other, 'end'));
	}
};

// starts the request transaction
Request.prototype.start = function() {
	var this2 = this;
	if (!this.isConnOpen) return this;
	if (this.isStarted) return this;
	if (!this.headers || !this.headers.url) throw "No URL on request";

	// Prep request
	if (typeof this.isVirtual == 'undefined') {
		// if not forced, decide on whether this is virtual based on the presence of a hash
		this.isVirtual = (this.headers.url.indexOf('#') !== -1);
	}
	this.urld = helpers.parseUri(this.headers.url);

	// Setup response object
	var requestStartTime = Date.now();
	var ires = new IncomingResponse();
	ires.on('headers', ires.processHeaders.bind(ires, this));
	ires.on('end', function() {
		// Track latency
		ires.latency = Date.now() - requestStartTime;
	});
	ires.on('close', function() {
		// Close the request (if its still open)
		this2.close();
	});

	var fulfill = fulfillResponsePromise.bind(null, this, ires);
	if (this.isBufferingResponse) {
		ires.buffer(fulfill);
	} else {
		ires.on('headers', fulfill);
	}
	ires.on('close', fulfill); // will have no effect if already called

	// Execute by scheme
	var scheme = (this.isVirtual) ? '#' : parseScheme(this.headers.url);
	var schemeHandler = schemes.get(scheme);
	if (schemeHandler) { schemeHandler(this, ires); }
	else {
		// invalid scheme
		var ores = new Response();
		ores.wireUp(ires);
		ores.status(0, 'unsupported scheme "'+scheme+'"').end();
	}

	this.isStarted = true;
	return this;
};

// sends data over the stream
// - emits the 'data' event
Request.prototype.write = function(data) {
	if (!this.isConnOpen) return this;
	if (!this.isStarted) this.start();
	if (this.isEnded) return this;
	this.emit('data', data);
	return this;
};

// ends the request stream
// - `data`: optional mixed, to write before ending
// - emits 'end' and 'close' events
Request.prototype.end = function(data) {
	if (!this.isConnOpen) return this;
	if (this.isEnded) return this;
	if (!this.isStarted) this.start();
	if (typeof data != 'undefined') {
		this.write(data);
	}
	this.isEnded = true;
	this.emit('end');
	// this.close();
	// ^ do not close - the response should close
	return this;
};

// closes the stream, aborting if not yet finished
// - emits 'close' event
Request.prototype.close = function() {
	if (!this.isConnOpen) return this;
	this.isConnOpen = false;
	this.emit('close');
	this.clearEvents();
	return this;
};

// helper
// fulfills/reject a promise for a response with the given response
function fulfillResponsePromise(p, response) {
	// wasnt streaming, fulfill now that full response is collected
	if (response.status >= 200 && response.status < 400)
		p.fulfill(response);
	else if (response.status >= 400 && response.status < 600 || response.status === 0)
		p.reject(response);
	else
		p.fulfill(response); // :TODO: 1xx protocol handling
}

// helper - extracts scheme from the url
function parseScheme(url) {
	var schemeMatch = /^([^.^:]*):/.exec(url);
	return (schemeMatch) ? schemeMatch[1] : 'http';
}
},{"../promises.js":4,"../util":8,"./content-types.js":10,"./helpers.js":11,"./incoming-response.js":15,"./schemes.js":18}],17:[function(require,module,exports){
var util = require('../util');
var promise = require('../promises.js').promise;
var helpers = require('./helpers.js');
var contentTypes = require('./content-types.js');

// Response
// ========
// EXPORTED
// Interface for sending responses (used in virtual servers)
function Response() {
	util.EventEmitter.call(this);

	this.headers = {};
	this.headers.status = 0;
	this.headers.reason = '';
	this.isBinary = false; // stream is binary? :TODO:

	// Stream state
	this.isConnOpen = true;
	this.isStarted = false;
	this.isEnded = false;
}
module.exports = Response;
Response.prototype = Object.create(util.EventEmitter.prototype);

// Status & reason setter
Response.prototype.status = function(code, reason) {
	this.headers.status = code;
	this.headers.reason = reason;
	// :TODO: lookup reason if not given
	return this;
};

// Status sugars
for (var i=200; i <= 599; i++) {
	(function(i) {
		Response.prototype['s'+i] = function(reason) {
			return this.status(i, reason);
		};
	})(i);
}

// Header setter
Response.prototype.header = function(k, v) {
	k = formatHeaderKey(k);
	// Convert mime if needed
	if (k == 'ContentType') {
		v = contentTypes.lookup(v);
	}
	this.headers[k] = v;
	return this;
};

// Header sugars
[ 'Allow', 'ContentType', 'Link', 'Location', 'Pragma' ].forEach(function(k) {
	Response.prototype[k] = function(v) {
		return this.header(k, v);
	};
});

// helper to convert a given header value to our standard format - camel case, no dashes
var headerKeyRegex = /(^|-)(.)/g;
function formatHeaderKey(str) {
	// strip any dashes, convert to camelcase
	// eg 'foo-bar' -> 'FooBar'
	return str.replace(headerKeyRegex, function(_0,_1,_2) { return _2.toUpperCase(); });
}

// Event connection helper
// connects events from this stream to the target (event proxying)
Response.prototype.wireUp = function(other, async) {
	if (async) {
		var nextTick = function(fn) { return function(value) { util.nextTick(fn.bind(null, value)); }; };
		this.once('headers', nextTick(other.emit.bind(other, 'headers')));
		this.on('data', nextTick(other.emit.bind(other, 'data')));
		this.once('end', nextTick(other.emit.bind(other, 'end')));
		this.once('close', nextTick(other.emit.bind(other, 'close')));
	} else {
		this.once('headers', other.emit.bind(other, 'headers'));
		this.on('data', other.emit.bind(other, 'data'));
		this.once('end', other.emit.bind(other, 'end'));
		this.once('close', other.emit.bind(other, 'close'));
	}
};

// writes the header to the response
// - emits the 'headers' event
Response.prototype.start = function() {
	if (!this.isConnOpen) return this;
	if (this.isEnded) return this;
	if (this.isStarted) return this;
	this.emit('headers', this.headers);
	this.isStarted = true;
	return this;
};

// sends data over the stream
// - emits the 'data' event
Response.prototype.write = function(data) {
	if (!this.isConnOpen) return this;
	if (this.isEnded) return this;
	if (!this.isStarted) this.start();
	this.emit('data', data);
	return this;
};

// ends the response stream
// - `data`: optional mixed, to write before ending
// - emits 'end' and 'close' events
Response.prototype.end = function(data) {
	if (!this.isConnOpen) return this;
	if (this.isEnded) return this;
	if (!this.isStarted) this.start();
	if (typeof data != 'undefined') {
		this.write(data);
	}
	this.isEnded = true;
	this.emit('end');
	this.close();
	return this;
};

// closes the stream, aborting if not yet finished
// - emits 'close' event
Response.prototype.close = function() {
	if (!this.isConnOpen) return this;
	this.isConnOpen = false;
	this.emit('close');
	this.clearEvents();
	return this;
};
},{"../promises.js":4,"../util":8,"./content-types.js":10,"./helpers.js":11}],18:[function(require,module,exports){
var util = require('../util');
var helpers = require('./helpers.js');
var contentTypes = require('./content-types.js');
var httpHeaders = require('./http-headers.js');
var Response = require('./response.js');

// schemes
// =======
// EXPORTED
// dispatch() handlers, matched to the scheme in the request URIs
var schemes = {
	register: schemes__register,
	unregister: schemes__unregister,
	get: schemes__get
};
var schemes__registry = {};
module.exports = schemes;

function schemes__register(scheme, handler) {
	if (scheme && Array.isArray(scheme)) {
		for (var i=0, ii=scheme.length; i < ii; i++)
			schemes__register(scheme[i], handler);
	} else
		schemes__registry[scheme] = handler;
}

function schemes__unregister(scheme) {
	delete schemes__registry[scheme];
}

function schemes__get(scheme) {
	return schemes__registry[scheme];
}


// HTTP
// ====
var inWorker = (typeof self != 'undefined' && typeof self.window == 'undefined');
schemes.register(['http', 'https'], function(oreq, ires) {
	var ores = new Response();
	ores.wireUp(ires);

	// No XHR in workers
	if (inWorker) {
		ores.status(0, 'public web requests are not allowed from workers');
		ores.end();
		return;
	}

	// parse URL
	var urld = helpers.parseUri(oreq.headers.url);

	// if query params were given in the headers, mix it into the urld
	if (Object.keys(oreq.headers.params).length) {
		var q = contentTypes.serialize('application/x-www-form-urlencoded', oreq.headers.params);
		if (q) {
			if (urld.query) { urld.query += '&' + q; }
			else            { urld.query = q; }
			urld.relative = urld.path + '?' + urld.query + ((urld.anchor) ? '#'+urld.anchor : '');
		}
	}

	// assemble the final url
	var url = ((urld.protocol) ? (urld.protocol + '://') : '//') + urld.authority + urld.relative;

	// create the xhr
	var xhrRequest = new XMLHttpRequest();
	xhrRequest.open(oreq.headers.method, url, true);
	if (oreq.isBinary) {
		xhrRequest.responseType = 'arraybuffer';
		if (oreq.stream)
			console.warn('Got HTTP/S request with isBinary=true and stream=true - sorry, not supported, binary responses must be buffered (its a browser thing)', request);
	}

	// set headers
	var headers = extractOreqHeaders(oreq.headers);
	for (var k in headers) {
		if (headers[k] !== null)
			xhrRequest.setRequestHeader(k, httpHeaders.serialize(k, headers[k]));
	}

	// buffer the body, send on end
	var body = '';
	oreq.on('data', function(data) {
		// :TODO: serialize non-string
		if (typeof data == 'string') { body += data; }
		else { body = data; } // assume it is an array buffer or some such
	});
	oreq.on('end', function() { xhrRequest.send(body); });

	// abort on oreq close
	oreq.on('close', function() {
		if (xhrRequest.readyState !== XMLHttpRequest.DONE) {
			xhrRequest.aborted = true;
			xhrRequest.abort();
		}
        ores.close();
	});

	// register res handlers
	var streamPoller=0, lenOnLastPoll=0, headersSent = false;
	xhrRequest.onreadystatechange = function() {
		if (xhrRequest.readyState >= XMLHttpRequest.HEADERS_RECEIVED && !headersSent) {
			headersSent = true;

			// extract headers
			var headers = {};
			if (xhrRequest.status !== 0) {
				if (xhrRequest.getAllResponseHeaders()) {
					xhrRequest.getAllResponseHeaders().split("\n").forEach(function(h) {
						if (!h) { return; }
						var kv = h.replace('\r','').split(': ');
						ores.header(kv[0], kv.slice(1).join(': '));
					});
				} else {
					// a bug in firefox causes getAllResponseHeaders to return an empty string on CORS
					// (not ideal, but) iterate the likely headers
					var extractHeader = function(k) {
						var v = xhrRequest.getResponseHeader(k);
						if (v) ores.header(k, v);
					};
					extractHeader('Accept-Ranges');
					extractHeader('Age');
					extractHeader('Allow');
					extractHeader('Cache-Control');
					extractHeader('Connection');
					extractHeader('Content-Encoding');
					extractHeader('Content-Language');
					extractHeader('Content-Length');
					extractHeader('Content-Location');
					extractHeader('Content-MD5');
					extractHeader('Content-Disposition');
					extractHeader('Content-Range');
					extractHeader('Content-Type');
					extractHeader('Date');
					extractHeader('ETag');
					extractHeader('Expires');
					extractHeader('Last-Modified');
					extractHeader('Link');
					extractHeader('Location');
					extractHeader('Pragma');
					extractHeader('Refresh');
					extractHeader('Retry-After');
					extractHeader('Server');
					extractHeader('Set-Cookie');
					extractHeader('Trailer');
					extractHeader('Transfer-Encoding');
					extractHeader('Vary');
					extractHeader('Via');
					extractHeader('Warning');
					extractHeader('WWW-Authenticate');
				}
			}

			// send headers
			ores.status(xhrRequest.status, xhrRequest.statusText);
			ores.start();

			// start polling for updates
			if (!oreq.isBinary) {
				// ^ browsers buffer binary responses, so dont bother streaming
				streamPoller = setInterval(function() {
					// new data?
					var len = xhrRequest.response.length;
					if (len > lenOnLastPoll) {
						var chunk = xhrRequest.response.slice(lenOnLastPoll);
						lenOnLastPoll = len;
						ores.write(chunk);
					}
				}, 50);
			}
		}
		if (xhrRequest.readyState === XMLHttpRequest.DONE) {
			if (streamPoller)
				clearInterval(streamPoller);
			if (ires.status !== 0 && xhrRequest.status === 0 && !xhrRequest.aborted) {
				// a sudden switch to 0 (after getting a non-0) probably means a timeout
				console.debug('XHR looks like it timed out; treating it as a premature close'); // just in case things get weird
				ores.close();
			} else {
				if (xhrRequest.response) {
					if (typeof xhrRequest.response == 'string') {
						var len = xhrRequest.response.length;
						if (len > lenOnLastPoll) {
							ores.write(xhrRequest.response.slice(lenOnLastPoll));
						}
					} else {
						ores.write(xhrRequest.response);
					}
				}
				ores.end();
			}
		}
	};
});

// helper
// pulls non-standard headers out of the request and makes sure they're formatted correctly
var ucRegEx = /([a-z])([A-Z])/g; // lowercase followed by an uppercase
function headerReplacer(all, $1, $2) { return $1+'-'+$2; }
function extractOreqHeaders(headers) {
	var extraHeaders = {};
	for (var k in headers) {
		if (helpers.isHeaderKey(k)) {
			var k2 = k.replace(ucRegEx, headerReplacer);
			extraHeaders[k2] = headers[k];
		}
	}
	return extraHeaders;
}

// Data
// ====
schemes.register('data', function(oreq, ires) {
	var firstColonIndex = oreq.headers.url.indexOf(':');
	var firstCommaIndex = oreq.headers.url.indexOf(',');

	// parse parameters
	var param;
	var params = oreq.headers.url.slice(firstColonIndex+1, firstCommaIndex).split(';');
	var contentType = params.shift();
	var isBase64 = false;
	while ((param = params.shift())) {
		if (param == 'base64')
			isBase64 = true;
	}

	// parse data
	var data = oreq.headers.url.slice(firstCommaIndex+1);
	if (!data) data = '';
	if (isBase64) data = atob(data);
	else data = decodeURIComponent(data);

	// respond
	var ores = new Response();
	ores.wireUp(ires);
	ores.s200().ContentType(contentType);
	ores.end(data);
});
},{"../util":8,"./content-types.js":10,"./helpers.js":11,"./http-headers.js":12,"./response.js":17}],19:[function(require,module,exports){
/*
 UriTemplate Copyright (c) 2012-2013 Franz Antesberger. All Rights Reserved.
 Available via the MIT license.
*/

(function (exportCallback) {
    "use strict";

var UriTemplateError = (function () {

    function UriTemplateError (options) {
        this.options = options;
    }

    UriTemplateError.prototype.toString = function () {
        if (JSON && JSON.stringify) {
            return JSON.stringify(this.options);
        }
        else {
            return this.options;
        }
    };

    return UriTemplateError;
}());

var objectHelper = (function () {
    function isArray (value) {
        return Object.prototype.toString.apply(value) === '[object Array]';
    }

    function isString (value) {
        return Object.prototype.toString.apply(value) === '[object String]';
    }

    function isNumber (value) {
        return Object.prototype.toString.apply(value) === '[object Number]';
    }

    function isBoolean (value) {
        return Object.prototype.toString.apply(value) === '[object Boolean]';
    }

    function join (arr, separator) {
        var
            result = '',
            first = true,
            index;
        for (index = 0; index < arr.length; index += 1) {
            if (first) {
                first = false;
            }
            else {
                result += separator;
            }
            result += arr[index];
        }
        return result;
    }

    function map (arr, mapper) {
        var
            result = [],
            index = 0;
        for (; index < arr.length; index += 1) {
            result.push(mapper(arr[index]));
        }
        return result;
    }

    function filter (arr, predicate) {
        var
            result = [],
            index = 0;
        for (; index < arr.length; index += 1) {
            if (predicate(arr[index])) {
                result.push(arr[index]);
            }
        }
        return result;
    }

    function deepFreezeUsingObjectFreeze (object) {
        if (typeof object !== "object" || object === null) {
            return object;
        }
        Object.freeze(object);
        var property, propertyName;
        for (propertyName in object) {
            if (object.hasOwnProperty(propertyName)) {
                property = object[propertyName];
                // be aware, arrays are 'object', too
                if (typeof property === "object") {
                    deepFreeze(property);
                }
            }
        }
        return object;
    }

    function deepFreeze (object) {
        if (typeof Object.freeze === 'function') {
            return deepFreezeUsingObjectFreeze(object);
        }
        return object;
    }


    return {
        isArray: isArray,
        isString: isString,
        isNumber: isNumber,
        isBoolean: isBoolean,
        join: join,
        map: map,
        filter: filter,
        deepFreeze: deepFreeze
    };
}());

var charHelper = (function () {

    function isAlpha (chr) {
        return (chr >= 'a' && chr <= 'z') || ((chr >= 'A' && chr <= 'Z'));
    }

    function isDigit (chr) {
        return chr >= '0' && chr <= '9';
    }

    function isHexDigit (chr) {
        return isDigit(chr) || (chr >= 'a' && chr <= 'f') || (chr >= 'A' && chr <= 'F');
    }

    return {
        isAlpha: isAlpha,
        isDigit: isDigit,
        isHexDigit: isHexDigit
    };
}());

var pctEncoder = (function () {
    var utf8 = {
        encode: function (chr) {
            // see http://ecmanaut.blogspot.de/2006/07/encoding-decoding-utf8-in-javascript.html
            return unescape(encodeURIComponent(chr));
        },
        numBytes: function (firstCharCode) {
            if (firstCharCode <= 0x7F) {
                return 1;
            }
            else if (0xC2 <= firstCharCode && firstCharCode <= 0xDF) {
                return 2;
            }
            else if (0xE0 <= firstCharCode && firstCharCode <= 0xEF) {
                return 3;
            }
            else if (0xF0 <= firstCharCode && firstCharCode <= 0xF4) {
                return 4;
            }
            // no valid first octet
            return 0;
        },
        isValidFollowingCharCode: function (charCode) {
            return 0x80 <= charCode && charCode <= 0xBF;
        }
    };

    function pad0(v) {
      if (v.length > 1) return v;
      return '0'+v;
    }

    /**
     * encodes a character, if needed or not.
     * @param chr
     * @return pct-encoded character
     */
    function encodeCharacter (chr) {
        var
            result = '',
            octets = utf8.encode(chr),
            octet,
            index;
        for (index = 0; index < octets.length; index += 1) {
            octet = octets.charCodeAt(index);
            result += '%' + pad0(octet.toString(16).toUpperCase());
        }
        return result;
    }

    /**
     * Returns, whether the given text at start is in the form 'percent hex-digit hex-digit', like '%3F'
     * @param text
     * @param start
     * @return {boolean|*|*}
     */
    function isPercentDigitDigit (text, start) {
        return text.charAt(start) === '%' && charHelper.isHexDigit(text.charAt(start + 1)) && charHelper.isHexDigit(text.charAt(start + 2));
    }

    /**
     * Parses a hex number from start with length 2.
     * @param text a string
     * @param start the start index of the 2-digit hex number
     * @return {Number}
     */
    function parseHex2 (text, start) {
        return parseInt(text.substr(start, 2), 16);
    }

    /**
     * Returns whether or not the given char sequence is a correctly pct-encoded sequence.
     * @param chr
     * @return {boolean}
     */
    function isPctEncoded (chr) {
        if (!isPercentDigitDigit(chr, 0)) {
            return false;
        }
        var firstCharCode = parseHex2(chr, 1);
        var numBytes = utf8.numBytes(firstCharCode);
        if (numBytes === 0) {
            return false;
        }
        for (var byteNumber = 1; byteNumber < numBytes; byteNumber += 1) {
            if (!isPercentDigitDigit(chr, 3*byteNumber) || !utf8.isValidFollowingCharCode(parseHex2(chr, 3*byteNumber + 1))) {
                return false;
            }
        }
        return true;
    }

    /**
     * Reads as much as needed from the text, e.g. '%20' or '%C3%B6'. It does not decode!
     * @param text
     * @param startIndex
     * @return the character or pct-string of the text at startIndex
     */
    function pctCharAt(text, startIndex) {
        var chr = text.charAt(startIndex);
        if (!isPercentDigitDigit(text, startIndex)) {
            return chr;
        }
        var utf8CharCode = parseHex2(text, startIndex + 1);
        var numBytes = utf8.numBytes(utf8CharCode);
        if (numBytes === 0) {
            return chr;
        }
        for (var byteNumber = 1; byteNumber < numBytes; byteNumber += 1) {
            if (!isPercentDigitDigit(text, startIndex + 3 * byteNumber) || !utf8.isValidFollowingCharCode(parseHex2(text, startIndex + 3 * byteNumber + 1))) {
                return chr;
            }
        }
        return text.substr(startIndex, 3 * numBytes);
    }

    return {
        encodeCharacter: encodeCharacter,
        isPctEncoded: isPctEncoded,
        pctCharAt: pctCharAt
    };
}());

var rfcCharHelper = (function () {

    /**
     * Returns if an character is an varchar character according 2.3 of rfc 6570
     * @param chr
     * @return (Boolean)
     */
    function isVarchar (chr) {
        return charHelper.isAlpha(chr) || charHelper.isDigit(chr) || chr === '_' || pctEncoder.isPctEncoded(chr);
    }

    /**
     * Returns if chr is an unreserved character according 1.5 of rfc 6570
     * @param chr
     * @return {Boolean}
     */
    function isUnreserved (chr) {
        return charHelper.isAlpha(chr) || charHelper.isDigit(chr) || chr === '-' || chr === '.' || chr === '_' || chr === '~';
    }

    /**
     * Returns if chr is an reserved character according 1.5 of rfc 6570
     * or the percent character mentioned in 3.2.1.
     * @param chr
     * @return {Boolean}
     */
    function isReserved (chr) {
        return chr === ':' || chr === '/' || chr === '?' || chr === '#' || chr === '[' || chr === ']' || chr === '@' || chr === '!' || chr === '$' || chr === '&' || chr === '(' ||
            chr === ')' || chr === '*' || chr === '+' || chr === ',' || chr === ';' || chr === '=' || chr === "'";
    }

    return {
        isVarchar: isVarchar,
        isUnreserved: isUnreserved,
        isReserved: isReserved
    };

}());

/**
 * encoding of rfc 6570
 */
var encodingHelper = (function () {

    function encode (text, passReserved) {
        var
            result = '',
            index,
            chr = '';
        if (typeof text === "number" || typeof text === "boolean") {
            text = text.toString();
        }
        for (index = 0; index < text.length; index += chr.length) {
            chr = text.charAt(index);
            result += rfcCharHelper.isUnreserved(chr) || (passReserved && rfcCharHelper.isReserved(chr)) ? chr : pctEncoder.encodeCharacter(chr);
        }
        return result;
    }

    function encodePassReserved (text) {
        return encode(text, true);
    }

    function encodeLiteralCharacter (literal, index) {
        var chr = pctEncoder.pctCharAt(literal, index);
        if (chr.length > 1) {
            return chr;
        }
        else {
            return rfcCharHelper.isReserved(chr) || rfcCharHelper.isUnreserved(chr) ? chr : pctEncoder.encodeCharacter(chr);
        }
    }

    function encodeLiteral (literal) {
        var
            result = '',
            index,
            chr = '';
        for (index = 0; index < literal.length; index += chr.length) {
            chr = pctEncoder.pctCharAt(literal, index);
            if (chr.length > 1) {
                result += chr;
            }
            else {
                result += rfcCharHelper.isReserved(chr) || rfcCharHelper.isUnreserved(chr) ? chr : pctEncoder.encodeCharacter(chr);
            }
        }
        return result;
    }

    return {
        encode: encode,
        encodePassReserved: encodePassReserved,
        encodeLiteral: encodeLiteral,
        encodeLiteralCharacter: encodeLiteralCharacter
    };

}());


// the operators defined by rfc 6570
var operators = (function () {

    var
        bySymbol = {};

    function create (symbol) {
        bySymbol[symbol] = {
            symbol: symbol,
            separator: (symbol === '?') ? '&' : (symbol === '' || symbol === '+' || symbol === '#') ? ',' : symbol,
            named: symbol === ';' || symbol === '&' || symbol === '?',
            ifEmpty: (symbol === '&' || symbol === '?') ? '=' : '',
            first: (symbol === '+' ) ? '' : symbol,
            encode: (symbol === '+' || symbol === '#') ? encodingHelper.encodePassReserved : encodingHelper.encode,
            toString: function () {
                return this.symbol;
            }
        };
    }

    create('');
    create('+');
    create('#');
    create('.');
    create('/');
    create(';');
    create('?');
    create('&');
    return {
        valueOf: function (chr) {
            if (bySymbol[chr]) {
                return bySymbol[chr];
            }
            if ("=,!@|".indexOf(chr) >= 0) {
                return null;
            }
            return bySymbol[''];
        }
    };
}());


/**
 * Detects, whether a given element is defined in the sense of rfc 6570
 * Section 2.3 of the RFC makes clear defintions:
 * * undefined and null are not defined.
 * * the empty string is defined
 * * an array ("list") is defined, if it is not empty (even if all elements are not defined)
 * * an object ("map") is defined, if it contains at least one property with defined value
 * @param object
 * @return {Boolean}
 */
function isDefined (object) {
    var
        propertyName;
    if (object === null || object === undefined) {
        return false;
    }
    if (objectHelper.isArray(object)) {
        // Section 2.3: A variable defined as a list value is considered undefined if the list contains zero members
        return object.length > 0;
    }
    if (typeof object === "string" || typeof object === "number" || typeof object === "boolean") {
        // falsy values like empty strings, false or 0 are "defined"
        return true;
    }
    // else Object
    for (propertyName in object) {
        if (object.hasOwnProperty(propertyName) && isDefined(object[propertyName])) {
            return true;
        }
    }
    return false;
}

var LiteralExpression = (function () {
    function LiteralExpression (literal) {
        this.literal = encodingHelper.encodeLiteral(literal);
    }

    LiteralExpression.prototype.expand = function () {
        return this.literal;
    };

    LiteralExpression.prototype.toString = LiteralExpression.prototype.expand;

    return LiteralExpression;
}());

var parse = (function () {

    function parseExpression (expressionText) {
        var
            operator,
            varspecs = [],
            varspec = null,
            varnameStart = null,
            maxLengthStart = null,
            index,
            chr = '';

        function closeVarname () {
            var varname = expressionText.substring(varnameStart, index);
            if (varname.length === 0) {
                throw new UriTemplateError({expressionText: expressionText, message: "a varname must be specified", position: index});
            }
            varspec = {varname: varname, exploded: false, maxLength: null};
            varnameStart = null;
        }

        function closeMaxLength () {
            if (maxLengthStart === index) {
                throw new UriTemplateError({expressionText: expressionText, message: "after a ':' you have to specify the length", position: index});
            }
            varspec.maxLength = parseInt(expressionText.substring(maxLengthStart, index), 10);
            maxLengthStart = null;
        }

        operator = (function (operatorText) {
            var op = operators.valueOf(operatorText);
            if (op === null) {
                throw new UriTemplateError({expressionText: expressionText, message: "illegal use of reserved operator", position: index, operator: operatorText});
            }
            return op;
        }(expressionText.charAt(0)));
        index = operator.symbol.length;

        varnameStart = index;

        for (; index < expressionText.length; index += chr.length) {
            chr = pctEncoder.pctCharAt(expressionText, index);

            if (varnameStart !== null) {
                // the spec says: varname =  varchar *( ["."] varchar )
                // so a dot is allowed except for the first char
                if (chr === '.') {
                    if (varnameStart === index) {
                        throw new UriTemplateError({expressionText: expressionText, message: "a varname MUST NOT start with a dot", position: index});
                    }
                    continue;
                }
                if (rfcCharHelper.isVarchar(chr)) {
                    continue;
                }
                closeVarname();
            }
            if (maxLengthStart !== null) {
                if (index === maxLengthStart && chr === '0') {
                    throw new UriTemplateError({expressionText: expressionText, message: "A :prefix must not start with digit 0", position: index});
                }
                if (charHelper.isDigit(chr)) {
                    if (index - maxLengthStart >= 4) {
                        throw new UriTemplateError({expressionText: expressionText, message: "A :prefix must have max 4 digits", position: index});
                    }
                    continue;
                }
                closeMaxLength();
            }
            if (chr === ':') {
                if (varspec.maxLength !== null) {
                    throw new UriTemplateError({expressionText: expressionText, message: "only one :maxLength is allowed per varspec", position: index});
                }
                if (varspec.exploded) {
                    throw new UriTemplateError({expressionText: expressionText, message: "an exploeded varspec MUST NOT be varspeced", position: index});
                }
                maxLengthStart = index + 1;
                continue;
            }
            if (chr === '*') {
                if (varspec === null) {
                    throw new UriTemplateError({expressionText: expressionText, message: "exploded without varspec", position: index});
                }
                if (varspec.exploded) {
                    throw new UriTemplateError({expressionText: expressionText, message: "exploded twice", position: index});
                }
                if (varspec.maxLength) {
                    throw new UriTemplateError({expressionText: expressionText, message: "an explode (*) MUST NOT follow to a prefix", position: index});
                }
                varspec.exploded = true;
                continue;
            }
            // the only legal character now is the comma
            if (chr === ',') {
                varspecs.push(varspec);
                varspec = null;
                varnameStart = index + 1;
                continue;
            }
            throw new UriTemplateError({expressionText: expressionText, message: "illegal character", character: chr, position: index});
        } // for chr
        if (varnameStart !== null) {
            closeVarname();
        }
        if (maxLengthStart !== null) {
            closeMaxLength();
        }
        varspecs.push(varspec);
        return new VariableExpression(expressionText, operator, varspecs);
    }

    function parse (uriTemplateText) {
        // assert filled string
        var
            index,
            chr,
            expressions = [],
            braceOpenIndex = null,
            literalStart = 0;
        for (index = 0; index < uriTemplateText.length; index += 1) {
            chr = uriTemplateText.charAt(index);
            if (literalStart !== null) {
                if (chr === '}') {
                    throw new UriTemplateError({templateText: uriTemplateText, message: "unopened brace closed", position: index});
                }
                if (chr === '{') {
                    if (literalStart < index) {
                        expressions.push(new LiteralExpression(uriTemplateText.substring(literalStart, index)));
                    }
                    literalStart = null;
                    braceOpenIndex = index;
                }
                continue;
            }

            if (braceOpenIndex !== null) {
                // here just { is forbidden
                if (chr === '{') {
                    throw new UriTemplateError({templateText: uriTemplateText, message: "brace already opened", position: index});
                }
                if (chr === '}') {
                    if (braceOpenIndex + 1 === index) {
                        throw new UriTemplateError({templateText: uriTemplateText, message: "empty braces", position: braceOpenIndex});
                    }
                    try {
                        expressions.push(parseExpression(uriTemplateText.substring(braceOpenIndex + 1, index)));
                    }
                    catch (error) {
                        if (error.prototype === UriTemplateError.prototype) {
                            throw new UriTemplateError({templateText: uriTemplateText, message: error.options.message, position: braceOpenIndex + error.options.position, details: error.options});
                        }
                        throw error;
                    }
                    braceOpenIndex = null;
                    literalStart = index + 1;
                }
                continue;
            }
            throw new Error('reached unreachable code');
        }
        if (braceOpenIndex !== null) {
            throw new UriTemplateError({templateText: uriTemplateText, message: "unclosed brace", position: braceOpenIndex});
        }
        if (literalStart < uriTemplateText.length) {
            expressions.push(new LiteralExpression(uriTemplateText.substr(literalStart)));
        }
        return new UriTemplate(uriTemplateText, expressions);
    }

    return parse;
}());

var VariableExpression = (function () {
    // helper function if JSON is not available
    function prettyPrint (value) {
        return (JSON && JSON.stringify) ? JSON.stringify(value) : value;
    }

    function isEmpty (value) {
        if (!isDefined(value)) {
            return true;
        }
        if (objectHelper.isString(value)) {
            return value === '';
        }
        if (objectHelper.isNumber(value) || objectHelper.isBoolean(value)) {
            return false;
        }
        if (objectHelper.isArray(value)) {
            return value.length === 0;
        }
        for (var propertyName in value) {
            if (value.hasOwnProperty(propertyName)) {
                return false;
            }
        }
        return true;
    }

    function propertyArray (object) {
        var
            result = [],
            propertyName;
        for (propertyName in object) {
            if (object.hasOwnProperty(propertyName)) {
                result.push({name: propertyName, value: object[propertyName]});
            }
        }
        return result;
    }

    function VariableExpression (templateText, operator, varspecs) {
        this.templateText = templateText;
        this.operator = operator;
        this.varspecs = varspecs;
    }

    VariableExpression.prototype.toString = function () {
        return this.templateText;
    };

    function expandSimpleValue(varspec, operator, value) {
        var result = '';
        value = value.toString();
        if (operator.named) {
            result += encodingHelper.encodeLiteral(varspec.varname);
            if (value === '') {
                result += operator.ifEmpty;
                return result;
            }
            result += '=';
        }
        if (varspec.maxLength !== null) {
            value = value.substr(0, varspec.maxLength);
        }
        result += operator.encode(value);
        return result;
    }

    function valueDefined (nameValue) {
        return isDefined(nameValue.value);
    }

    function expandNotExploded(varspec, operator, value) {
        var
            arr = [],
            result = '';
        if (operator.named) {
            result += encodingHelper.encodeLiteral(varspec.varname);
            if (isEmpty(value)) {
                result += operator.ifEmpty;
                return result;
            }
            result += '=';
        }
        if (objectHelper.isArray(value)) {
            arr = value;
            arr = objectHelper.filter(arr, isDefined);
            arr = objectHelper.map(arr, operator.encode);
            result += objectHelper.join(arr, ',');
        }
        else {
            arr = propertyArray(value);
            arr = objectHelper.filter(arr, valueDefined);
            arr = objectHelper.map(arr, function (nameValue) {
                return operator.encode(nameValue.name) + ',' + operator.encode(nameValue.value);
            });
            result += objectHelper.join(arr, ',');
        }
        return result;
    }

    function expandExplodedNamed (varspec, operator, value) {
        var
            isArray = objectHelper.isArray(value),
            arr = [];
        if (isArray) {
            arr = value;
            arr = objectHelper.filter(arr, isDefined);
            arr = objectHelper.map(arr, function (listElement) {
                var tmp = encodingHelper.encodeLiteral(varspec.varname);
                if (isEmpty(listElement)) {
                    tmp += operator.ifEmpty;
                }
                else {
                    tmp += '=' + operator.encode(listElement);
                }
                return tmp;
            });
        }
        else {
            arr = propertyArray(value);
            arr = objectHelper.filter(arr, valueDefined);
            arr = objectHelper.map(arr, function (nameValue) {
                var tmp = encodingHelper.encodeLiteral(nameValue.name);
                if (isEmpty(nameValue.value)) {
                    tmp += operator.ifEmpty;
                }
                else {
                    tmp += '=' + operator.encode(nameValue.value);
                }
                return tmp;
            });
        }
        return objectHelper.join(arr, operator.separator);
    }

    function expandExplodedUnnamed (operator, value) {
        var
            arr = [],
            result = '';
        if (objectHelper.isArray(value)) {
            arr = value;
            arr = objectHelper.filter(arr, isDefined);
            arr = objectHelper.map(arr, operator.encode);
            result += objectHelper.join(arr, operator.separator);
        }
        else {
            arr = propertyArray(value);
            arr = objectHelper.filter(arr, function (nameValue) {
                return isDefined(nameValue.value);
            });
            arr = objectHelper.map(arr, function (nameValue) {
                return operator.encode(nameValue.name) + '=' + operator.encode(nameValue.value);
            });
            result += objectHelper.join(arr, operator.separator);
        }
        return result;
    }


    VariableExpression.prototype.expand = function (variables) {
        var
            expanded = [],
            index,
            varspec,
            value,
            valueIsArr,
            oneExploded = false,
            operator = this.operator;

        // expand each varspec and join with operator's separator
        for (index = 0; index < this.varspecs.length; index += 1) {
            varspec = this.varspecs[index];
            value = variables[varspec.varname];
            // if (!isDefined(value)) {
            // if (variables.hasOwnProperty(varspec.name)) {
            if (value === null || value === undefined) {
                continue;
            }
            if (varspec.exploded) {
                oneExploded = true;
            }
            valueIsArr = objectHelper.isArray(value);
            if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
                expanded.push(expandSimpleValue(varspec, operator, value));
            }
            else if (varspec.maxLength && isDefined(value)) {
                // 2.4.1 of the spec says: "Prefix modifiers are not applicable to variables that have composite values."
                throw new Error('Prefix modifiers are not applicable to variables that have composite values. You tried to expand ' + this + " with " + prettyPrint(value));
            }
            else if (!varspec.exploded) {
                if (operator.named || !isEmpty(value)) {
                    expanded.push(expandNotExploded(varspec, operator, value));
                }
            }
            else if (isDefined(value)) {
                if (operator.named) {
                    expanded.push(expandExplodedNamed(varspec, operator, value));
                }
                else {
                    expanded.push(expandExplodedUnnamed(operator, value));
                }
            }
        }

        if (expanded.length === 0) {
            return "";
        }
        else {
            return operator.first + objectHelper.join(expanded, operator.separator);
        }
    };

    return VariableExpression;
}());

var UriTemplate = (function () {
    function UriTemplate (templateText, expressions) {
        this.templateText = templateText;
        this.expressions = expressions;
        objectHelper.deepFreeze(this);
    }

    UriTemplate.prototype.toString = function () {
        return this.templateText;
    };

    UriTemplate.prototype.expand = function (variables) {
        // this.expressions.map(function (expression) {return expression.expand(variables);}).join('');
        var
            index,
            result = '';
        for (index = 0; index < this.expressions.length; index += 1) {
            result += this.expressions[index].expand(variables);
        }
        return result;
    };

    UriTemplate.parse = parse;
    UriTemplate.UriTemplateError = UriTemplateError;
    return UriTemplate;
}());

    exportCallback(UriTemplate);

}(function (UriTemplate) {
    module.exports = UriTemplate;
}));
},{}],20:[function(require,module,exports){
var helpers = require('./helpers.js');
var promise = require('../promises.js').promise;
var Bridge = require('./bridge.js');

module.exports = {
	getWorker: get,
	spawnWorker: spawnWorker,
	spawnTempWorker: spawnTempWorker
};

var _workers = {};
// a map of known protocols for http/s domains
// (reduces the frequency of failed HTTPS lookups when loading scripts without a scheme)
var _domainSchemes = {};

// lookup active worker by urld
function get(urld) {
	if (typeof urld == 'string') {
		urld = helpers.parseUri(urld);
	}

	// Relative to current host? Construct full URL
	if (!urld.authority || urld.authority == '.' || urld.authority.indexOf('.') === -1) {
		var dir = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'));
		var dirurl = window.location.protocol + '//' + window.location.hostname + dir;
		var url = helpers.joinRelPath(dirurl, urld.source);
		urld = local.parseUri(url);
	}

	// Lookup from existing children
	var worker = _workers[urld.authority+urld.path];
	if (worker) {
		return worker.bridge.onRequest.bind(worker.bridge);
	}

	// Nothing exists yet - is it a .js?
	if (urld.path.slice(-3) == '.js') {
		// Try to autoload temp worker
		worker = spawnTempWorker(urld);
		return worker.bridge.onRequest.bind(worker.bridge);
	}

	// Send back a failure responder
	return function(req, res) {
		res.status(0, 'request to '+req.headers.url+' expects '+req.urld.path+' to be a .js file');
		res.end();
	};
}

function spawnTempWorker(urld) {
	var worker = spawnWorker(urld);
	worker.setTemporary();
	return worker;
}

function spawnWorker(urld) {
	if (typeof urld == 'string') {
		urld = helpers.parseUri(urld);
	}

	// Relative to current host? Construct full URL
	if (!urld.authority || urld.authority == '.' || urld.authority.indexOf('.') === -1) {
		var dir = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'));
		var dirurl = window.location.protocol + '//' + window.location.hostname + dir;
		var url = helpers.joinRelPath(dirurl, urld.source);
		urld = local.parseUri(url);
	}

	// Eject a temp server if needed
	// :TODO:
	/*var nWorkerServers = 0, ejectCandidate = null;
	for (var d in httpl.getServers()) {
		var s = httpl.getServer(d).context;
		if (!(s instanceof WorkerBridgeServer))
			continue;
		if (!ejectCandidate && s.config.temp && !s.isInTransaction())
			ejectCandidate = s;
		nWorkerServers++;
	}
	if (nWorkerServers >= localConfig.maxActiveWorkers && ejectCandidate) {
		console.log('Closing temporary worker', ejectCandidate.config.domain);
		ejectCandidate.terminate();
		httpl.removeServer(ejectCandidate.config.domain);
	}*/

	var worker = new WorkerWrapper();
	_workers[urld.authority+urld.path] = worker;
	worker.load(urld);
	return worker;
}

function WorkerWrapper() {
	this.isActive = false;
	this.isTemp = false;

	this.worker = null;
	this.bridge = new Bridge(this);

	this.script_blob = null;
	this.script_objurl = null;
	this.source_url = null;
}

WorkerWrapper.prototype.setTemporary = function(v) {
	if (typeof v == 'undefined') v = true;
	this.isTemp = v;
};

WorkerWrapper.prototype.load = function(urld) {
	var url = urld.source;
	var this2 = this;

	// If no scheme was given, check our cache to see if we can save ourselves some trouble
	var full_url = url;
    if (!urld.protocol) {
        var scheme = _domainSchemes[urld.authority];
        if (!scheme) {
            scheme = _domainSchemes[urld.authority] = 'https://';
        }
        full_url = scheme + url;
    }

    // Try to fetch the script
	GET(full_url)
		.Accept('application/javascript, text/javascript, text/plain, */*')
		.fail(function(res) {
			if (!urld.protocol && res.status === 0) {
				// Domain error? Try again without ssl
                full_url = 'http://'+url;
                _domainSchemes[urld.authority] = 'http://'; // we know it isn't https at least
				return GET(full_url);
			}
			throw res;
		})
		.then(function(res) {
			this2.source_url = full_url;

			// Setup the bootstrap source to import scripts relative to the origin
			var bootstrap_src = require('../config.js').workerBootstrapScript;
			var hosturld = local.parseUri((urld.protocol != 'data') ? full_url : (window.location.protocol+'//'+window.location.hostname));
			var hostroot = hosturld.protocol + '://' + hosturld.authority;
			bootstrap_src = bootstrap_src.replace(/<HOST>/g, hostroot);
			bootstrap_src = bootstrap_src.replace(/<HOST_DIR_PATH>/g, (hosturld.directory||'').slice(0,-1));
			bootstrap_src = bootstrap_src.replace(/<HOST_DIR_URL>/g, hostroot + (hosturld.directory||'').slice(0,-1));

			// Create worker
			this2.script_blob = new Blob([bootstrap_src+res.body], { type: "text/javascript" });
			this2.script_objurl = window.URL.createObjectURL(this2.script_blob);
			this2.worker = new Worker(this2.script_objurl);
			this2.setup();
		})
		.fail(function(res) {
			this2.terminate(404, 'Worker Not Found');
		});
};

WorkerWrapper.prototype.setup = function() {
	var this2 = this;

	// Setup the incoming message handler
	this.worker.addEventListener('message', function(event) {
		var message = event.data;
		if (!message)
			return console.error('Invalid message from worker: Payload missing', this, event);

		// Handle messages with an `op` field as worker-control packets rather than HTTPL messages
		switch (message.op) {
			case 'ready':
				this2.isActive = true;
				this2.bridge.flushBufferedMessages();
				break;
			case 'log':
				this2.onWorkerLog(message.body);
				break;
			case 'terminate':
				this2.terminate();
				break;
			default:
				// If no 'op' field is given, treat it as an HTTPL request and pass onto our bridge
				this2.bridge.onMessage(message);
				break;
		}
	});

	// :TOOD: set terminate timeout for if no ready received
};

// Wrapper around the worker postMessage
WorkerWrapper.prototype.postMessage = function(msg) {
	if (this.worker) this.worker.postMessage(msg);
};

// Cleanup
WorkerWrapper.prototype.terminate = function(status, reason) {
	if (this.bridge) this.bridge.terminate(status, reason);
	if (this.worker) this.worker.terminate();
	if (this.script_objurl) window.URL.revokeObjectURL(this.script_objurl);

	this.bridge = null;
	this.worker = null;
	this.script_blob = null;
	this.script_objurl = null;
	this.isActive = false;
};

// Logs message data from the worker
WorkerWrapper.prototype.onWorkerLog = function(message) {
	if (!message)
		return;
	if (!Array.isArray(message))
		return console.error('Received invalid "log" operation: Payload must be an array', message);

	var type = message.shift();
	var args = ['['+this.source_url+']'].concat(message);
	switch (type) {
		case 'error':
			console.error.apply(console, args);
			break;
		case 'warn':
			console.warn.apply(console, args);
			break;
		default:
			console.log.apply(console, args);
			break;
	}
};
},{"../config.js":1,"../promises.js":4,"./bridge.js":9,"./helpers.js":11}],21:[function(require,module,exports){
if (typeof self != 'undefined' && typeof self.window == 'undefined') { (function() {
	// GLOBAL
	// custom console.*
	self.console = {
		log: function() {
			var args = Array.prototype.slice.call(arguments);
			doLog('log', args);
		},
		dir: function() {
			var args = Array.prototype.slice.call(arguments);
			doLog('dir', args);
		},
		debug: function() {
			var args = Array.prototype.slice.call(arguments);
			doLog('debug', args);
		},
		warn: function() {
			var args = Array.prototype.slice.call(arguments);
			doLog('warn', args);
		},
		error: function() {
			var args = Array.prototype.slice.call(arguments);
			doLog('error', args);
		}
	};
	function doLog(type, args) {
		try { self.postMessage({ op: 'log', body: [type].concat(args) }); }
		catch (e) {
			// this is usually caused by trying to log information that cant be serialized
			self.postMessage({ op: 'log', body: [type].concat(args.map(JSONifyMessage)) });
		}
	}
	// helper to try to get a failed log message through
	function JSONifyMessage(data) {
		if (Array.isArray(data))
			return data.map(JSONifyMessage);
		if (data && typeof data == 'object')
			return JSON.stringify(data);
		return data;
	}

	// GLOBAL
	// btoa polyfill
	// - from https://github.com/lydonchandra/base64encoder
	//   (thanks to Lydon Chandra)
	if (typeof btoa == 'undefined') {
		var PADCHAR = '=';
		var ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
		function getbyte(s,i) {
			var x = s.charCodeAt(i) & 0xFF;
			return x;
		}
		self.btoa = function(s) {
			var padchar = PADCHAR;
			var alpha   = ALPHA;

			var i, b10;
			var x = [];

			// convert to string
			s = '' + s;

			var imax = s.length - s.length % 3;

			if (s.length === 0) {
				return s;
			}
			for (i = 0; i < imax; i += 3) {
				b10 = (getbyte(s,i) << 16) | (getbyte(s,i+1) << 8) | getbyte(s,i+2);
				x.push(alpha.charAt(b10 >> 18));
				x.push(alpha.charAt((b10 >> 12) & 0x3F));
				x.push(alpha.charAt((b10 >> 6) & 0x3f));
				x.push(alpha.charAt(b10 & 0x3f));
			}
			switch (s.length - imax) {
			case 1:
				b10 = getbyte(s,i) << 16;
				x.push(alpha.charAt(b10 >> 18) + alpha.charAt((b10 >> 12) & 0x3F) + padchar + padchar);
				break;
			case 2:
				b10 = (getbyte(s,i) << 16) | (getbyte(s,i+1) << 8);
				x.push(alpha.charAt(b10 >> 18) + alpha.charAt((b10 >> 12) & 0x3F) +
					   alpha.charAt((b10 >> 6) & 0x3f) + padchar);
				break;
			}
			return x.join('');
		};
	}

	// Setup page connection
	var Bridge = require('../web/bridge.js');
	var pageBridge = new Bridge(self);
	self.addEventListener('message', function(event) {
		var message = event.data;
		if (!message)
			return console.error('Invalid message from page: Payload missing', event);
		pageBridge.onMessage(message);
	});
	self.postMessage({ op: 'ready' });
})(); }
},{"../web/bridge.js":9}]},{},[3])
;