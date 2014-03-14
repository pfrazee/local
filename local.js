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
				'return "{{HOST}}" + relpath;',
			'}',
			'// totally relative, oh god',
			'// (thanks to geoff parker for this)',
			'var hostpath = "{{HOST_DIR_PATH}}";',
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
			'return "{{HOST}}/" + hostpathParts.join(\'/\');',
		'}',
		'var isImportingAllowed = true;',
		'setTimeout(function() { isImportingAllowed = false; },0);', // disable after initial run
		'importScripts = function() {',
			'if (!isImportingAllowed) { throw "Local.js - Imports disabled after initial load to prevent data-leaking"; }',
			'return orgImportScripts.apply(null, Array.prototype.map.call(arguments, function(v, i) {',
				'return (v.indexOf(\'/\') < v.indexOf(/[.:]/) || v.charAt(0) == \'/\' || v.charAt(0) == \'.\') ? joinRelPath(\'{{HOST_DIR_URL}}\',v) : v;',
			'}));',
		'};',
	'})();\n'
].join('\n');

module.exports = {
	logAllExceptions: false,
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
	Server: require('./web/server.js'),
	Relay: require('./web/relay.js'),
	BridgeServer: require('./web/bridge-server.js'),
	WorkerBridgeServer: require('./web/worker-bridge-server.js'),
	RTCBridgeServer: require('./web/rtc-bridge-server.js'),
	UriTemplate: require('./web/uri-template.js'),

	util: util,
	schemes: require('./web/schemes.js'),
	httpHeaders: require('./web/http-headers.js'),
	contentTypes: require('./web/content-types.js'),

	worker: require('./worker'),
};
util.mixin.call(module.exports, require('./constants.js'));
util.mixin.call(module.exports, require('./config.js'));
util.mixin.call(module.exports, require('./promises.js'));
util.mixin.call(module.exports, require('./spawners.js'));
util.mixin.call(module.exports, require('./request-event.js'));
util.mixin.call(module.exports, require('./web/helpers.js'));
util.mixin.call(module.exports, require('./web/httpl.js'));
util.mixin.call(module.exports, require('./web/dispatch.js'));
util.mixin.call(module.exports, require('./web/subscribe.js'));
util.mixin.call(module.exports, require('./web/agent.js'));

if (typeof window != 'undefined') window.local = module.exports;
else if (typeof self != 'undefined') self.local = module.exports;
else local = module.exports;

// Local Registry Host
local.addServer('hosts', function(req, res) {
	var localHosts = local.getServers();

	if (!(req.method == 'HEAD' || req.method == 'GET'))
		return res.writeHead(405, 'bad method').end();

	if (req.method == 'GET' && !local.preferredType(req, 'application/json'))
		return res.writeHead(406, 'bad accept - only provides application/json').end();

	var responses_ = [];
	var domains = [], links = [];
	links.push({ href: '/', rel: 'self service via', id: 'hosts', title: 'Page Hosts' });
	for (var domain in localHosts) {
		if (domain == 'hosts')
			continue;
		domains.push(domain);
		responses_.push(local.dispatch({ method: 'HEAD', url: 'httpl://'+domain, timeout: 500 }));
	}

	local.promise.bundle(responses_).then(function(ress) {
		ress.forEach(function(res, i) {
			var selfLink = local.queryLinks(res, { rel: 'self' })[0];
			if (!selfLink) {
				selfLink = { rel: 'service', id: domains[i], href: 'httpl://'+domains[i] };
			}
			selfLink.rel = (selfLink.rel) ? selfLink.rel.replace(/(^|\b)(self|up|via)(\b|$)/gi, '') : 'service';
			links.push(selfLink);
		});

		res.setHeader('link', links);
		if (req.method == 'HEAD')
			return res.writeHead(204, 'ok, no content').end();
		res.writeHead(200, 'ok', { 'content-type': 'application/json' });
		res.end({ host_names: domains });
	});
});
},{"./config.js":1,"./constants.js":2,"./promises.js":4,"./request-event.js":5,"./spawners.js":6,"./util":9,"./web/agent.js":10,"./web/bridge-server.js":11,"./web/content-types.js":12,"./web/dispatch.js":13,"./web/helpers.js":14,"./web/http-headers.js":15,"./web/httpl.js":16,"./web/relay.js":17,"./web/request.js":18,"./web/response.js":19,"./web/rtc-bridge-server.js":20,"./web/schemes.js":21,"./web/server.js":22,"./web/subscribe.js":23,"./web/uri-template.js":24,"./web/worker-bridge-server.js":25,"./worker":27}],4:[function(require,module,exports){
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
		util.nextTick(function() {
			if (self.isFulfilled())
				execCallback(self, p, succeedFn);
			else
				execCallback(self, p, failFn);
		});
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
},{"./config.js":1,"./util":9}],5:[function(require,module,exports){
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
},{"./util":9}],6:[function(require,module,exports){
// Helpers to create servers
// -

var helpers = require('./web/helpers.js');
var httpl = require('./web/httpl.js');
var WorkerBridgeServer = require('./web/worker-bridge-server.js');
var Relay = require('./web/relay.js');

// EXPORTED
// Creates a Web Worker and a bridge server to the worker
// eg `local.spawnWorkerServer('http://foo.com/myworker.js', localServerFn)
// - `src`: optional string, the URI to load into the worker. If null, must give `config.domain` with a source-path
// - `config`: optional object, additional config options to pass to the worker
// - `config.domain`: optional string, overrides the automatic domain generation
// - `config.temp`: boolean, should the workerserver be destroyed after it handles it's requests?
// - `config.shared`: boolean, should the workerserver be shared?
// - `config.namespace`: optional string, what should the shared worker be named?
//   - defaults to `config.src` if undefined
// - `serverFn`: optional function, a response generator for requests from the worker
function spawnWorkerServer(src, config, serverFn) {
	if (typeof config == 'function') { serverFn = config; config = null; }
	if (!config) { config = {}; }
	config.src = src;
	config.serverFn = serverFn;

	// Create the domain
	var domain = config.domain;
	if (!domain) {
		if (local.isAbsUri(src)) {
			var urld = helpers.parseUri(src);
			domain = urld.authority + '(' + urld.path.slice(1) + ')';
		} else {
			var src_parts = src.split(/[\?#]/);
			domain = window.location.host + '(' + src_parts[0].slice(1) + ')';
		}
	}

	// Create the server
	if (httpl.getServer(domain)) throw "Worker already exists";
	var server = new WorkerBridgeServer(config);
	httpl.addServer(domain, server);

	return server;
}

// EXPORTED
// Opens a stream to a peer relay
// - `providerUrl`: optional string, the relay provider
// - `config.app`: optional string, the app to join as (defaults to window.location.host)
// - `serverFn`: optional function, a response generator for requests from connected peers
function joinRelay(providerUrl, config, serverFn) {
	if (typeof config == 'function') { serverFn = config; config = null; }
	if (!config) config = {};
	config.provider = providerUrl;
	config.serverFn = serverFn;
	return new Relay(config);
}
module.exports = {
	spawnWorkerServer: spawnWorkerServer,
	joinRelay: joinRelay
};
},{"./web/helpers.js":14,"./web/httpl.js":16,"./web/relay.js":17,"./web/worker-bridge-server.js":25}],7:[function(require,module,exports){
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
},{"../promises.js":4}],8:[function(require,module,exports){
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
	Object.defineProperty(this, '_suspensions', {
		value: 0,
		configurable: false,
		enumerable: false,
		writable: true
	});
	Object.defineProperty(this, '_history', {
		value: [],
		configurable: false,
		enumerable: false,
		writable: true
	});
}
module.exports = EventEmitter;

EventEmitter.prototype.suspendEvents = function() {
	this._suspensions++;
};

EventEmitter.prototype.resumeEvents = function() {
	this._suspensions--;
	if (this._suspensions <= 0)
		this.playbackHistory();
};

EventEmitter.prototype.isSuspended = function() { return this._suspensions > 0; };

EventEmitter.prototype.playbackHistory = function() {
	var e;
	// always check if we're suspended - a handler might resuspend us
	while (!this.isSuspended() && (e = this._history.shift()))
		this.emit.apply(this, e);
};

EventEmitter.prototype.emit = function(type) {
	var args = Array.prototype.slice.call(arguments);

	if (this.isSuspended()) {
		this._history.push(args);
		return;
	}

	var handlers = this._events[type];
	if (!handlers) return false;

	args = args.slice(1);
	for (var i = 0, l = handlers.length; i < l; i++)
		handlers[i].apply(this, args);

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
	if (this._history[type]) this._history[type] = null;
	return this;
};

EventEmitter.prototype.listeners = function(type) {
	return this._events[type];
};
},{}],9:[function(require,module,exports){
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
	var nextTickIndex = 0, nextTickFns = {};
	nextTick = function(fn) {
		if (typeof fn != 'function') { throw "Invalid function provided to nextTick"; }
		window.postMessage('nextTick'+nextTickIndex, '*');
		nextTickFns['nextTick'+nextTickIndex] = fn;
		nextTickIndex++;
	};
	window.addEventListener('message', function(evt){
		var fn = nextTickFns[evt.data];
		if (fn) {
			delete nextTickFns[evt.data];
			fn();
		}
	}, true);

	// The following is the original version by // https://github.com/timoxley/next-tick
	// It was replaced by the above to avoid the try/catch block
	/*
	var nextTickQueue = [];
	nextTick = function(fn) {
		if (!nextTickQueue.length) window.postMessage('nextTick', '*');
		nextTickQueue.push(fn);
	};
	window.addEventListener('message', function(evt){
		if (evt.data != 'nextTick') { return; }
		var i = 0;
		while (i < nextTickQueue.length) {
			try { nextTickQueue[i++](); }
			catch (e) {
				nextTickQueue = nextTickQueue.slice(i);
				window.postMessage('nextTick', '*');
				throw e;
			}
		}
		nextTickQueue.length = 0;
	}, true);
	*/
}

module.exports = {
	EventEmitter: EventEmitter,

	mixin: mixin,
	mixinEventEmitter: mixinEventEmitter,
	deepClone: deepClone,
	nextTick: nextTick
};
mixin.call(module.exports, DOM);
},{"./dom.js":7,"./event-emitter.js":8}],10:[function(require,module,exports){
var constants = require('../constants.js');
var util = require('../util');
var promise = require('../promises.js').promise;
var helpers = require('./helpers.js');
var UriTemplate = require('./uri-template.js');
var httpl = require('./httpl.js');
var Request = require('./request.js');
var Response = require('./response.js');
var dispatch = require('./dispatch.js').dispatch;
var subscribe = require('./subscribe.js').subscribe;

// AgentContext
// ============
// INTERNAL
// information about the resource that a agent targets
//  - exists in an "unresolved" state until the URI is confirmed by a response from the server
//  - enters a "bad" state if an attempt to resolve the link failed
//  - may be "relative" if described by a relation from another context (eg a query or a relative URI)
//  - may be "absolute" if described by an absolute URI
// :NOTE: absolute contexts may have a URI without being resolved, so don't take the presence of a URI as a sign that the resource exists
function AgentContext(query) {
	this.query = query;
	this.resolveState = AgentContext.UNRESOLVED;
	this.error = null;
	this.queryIsAbsolute = (typeof query == 'string' && helpers.isAbsUri(query));
	if (this.queryIsAbsolute) {
		this.url  = query;
		this.urld = helpers.parseUri(this.url);
	} else {
		this.url  = null;
		this.urld = null;
	}
}
AgentContext.UNRESOLVED = 0;
AgentContext.RESOLVED   = 1;
AgentContext.FAILED     = 2;
AgentContext.prototype.isResolved = function() { return this.resolveState === AgentContext.RESOLVED; };
AgentContext.prototype.isBad      = function() { return this.resolveState === AgentContext.FAILED; };
AgentContext.prototype.isRelative = function() { return (!this.queryIsAbsolute); };
AgentContext.prototype.isAbsolute = function() { return this.queryIsAbsolute; };
AgentContext.prototype.getUrl     = function() { return this.url; };
AgentContext.prototype.getError   = function() { return this.error; };
AgentContext.prototype.resetResolvedState = function() {
	this.resolveState = AgentContext.UNRESOLVED;
	this.error = null;
};
AgentContext.prototype.setResolved = function(url) {
	this.error = null;
	this.resolveState = AgentContext.RESOLVED;
	if (url) {
		this.url  = url;
		this.urld = helpers.parseUri(this.url);
	}
};
AgentContext.prototype.setFailed = function(error) {
	this.error = error;
	this.resolveState = AgentContext.FAILED;
};

// Agent
// =========
// EXPORTED
// API to follow resource links (as specified by the response Link header)
//  - uses the rel attribute as the primary link label
//  - uses URI templates to generate URIs
//  - queues link navigations until a request is made
/*

// EXAMPLE 1. Get Bob from Foobar.com
// - basic navigation
// - requests
var foobarService = local.agent('https://foobar.com');
var bob = foobarService.follow('|collection=users|item=bob');
// ^ or local.agent('nav:||https://foobar.com|collection=users|item=bob')
// ^ or foobarService.follow([{ rel: 'collection', id: 'users' }, { rel: 'item', id:'bob' }]);
// ^ or foobarService.follow({ rel: 'collection', id: 'users' }).follow({ rel: 'item', id:'bob' });
bob.get()
	// -> HEAD https://foobar.com
	// -> HEAD https://foobar.com/users
	// -> GET  https://foobar.com/users/bob (Accept: application/json)
	.then(function(response) {
		var bobsProfile = response.body;

		// Update Bob's email
		bobsProfile.email = 'bob@gmail.com';
		bob.put(bobsProfile);
		// -> PUT https://foobar.com/users/bob { email:'bob@gmail.com', ...} (Content-Type: application/json)
	});

// EXAMPLE 2. Get all users who joined after 2013, in pages of 150
// - additional navigation query parameters
// - server-driven batching
var pageCursor = foobarService.follow('|collection=users,since=2013-01-01,limit=150');
pageCursor.get()
	// -> GET https://foobar.com/users?since=2013-01-01&limit=150 (Accept: application/json)
	.then(function readNextPage(response) {
		// Send the emails
		emailNewbieGreetings(response.body); // -- emailNewbieGreetings is a fake utility function

		// Go to the 'next page' link, as supplied by the response
		pageCursor = pageCursor.follow('|next');
		return pageCursor.get().then(readNextPage);
		// -> GET https://foobar.com/users?since=2013-01-01&limit=150&offset=150 (Accept: application/json)
	})
	.fail(function(response, request) {
		// Not finding a 'rel=next' link means the server didn't give us one.
		if (response.status == local.LINK_NOT_FOUND) { // 001 Local: Link not found - termination condition
			// Tell Bob his greeting was sent
			bob.follow('|grimwire.com/-mail/inbox').post({
				title: '2013 Welcome Emails Sent',
				body: 'Good work, Bob.'
			});
			// -> POST https://foobar.com/mail/users/bob/inbox (Content-Type: application/json)
		} else {
			// Tell Bob something went wrong
			bob.follow('|grimwire.com/-mail/inbox').post({
				title: 'ERROR! 2013 Welcome Emails Failed!',
				body: 'Way to blow it, Bob.',
				attachments: {
					'dump.json': {
						context: pageCursor.getContext(),
						request: request,
						response: response
					}
				}
			});
			// -> POST https://foobar.com/mail/users/bob/inbox (Content-Type: application/json)
		}
	});
*/
function Agent(context, parentAgent) {
	this.context         = context         || null;
	this.parentAgent = parentAgent || null;
	this.links           = null;
	this.proxyTmpl       = null;
	this.requestDefaults = null;
}

// Sets defaults to be used in all requests
// - eg nav.setRequestDefaults({ method: 'GET', headers: { authorization: 'bob:pass', accept: 'text/html' }})
// - eg nav.setRequestDefaults({ proxy: 'httpl://myproxy.app' })
Agent.prototype.setRequestDefaults = function(v) {
	this.requestDefaults = v;
};

// Helper to copy over request defaults
function copyDefaults(target, defaults) {
	for (var k in defaults) {
		if (k == 'headers' || !!target[k])
			continue;
		// ^ headers should be copied per-attribute
		if (typeof defaults[k] == 'object')
			target[k] = util.deepClone(defaults[k]);
		else
			target[k] = defaults[k];
	}
	if (defaults.headers) {
		if (!target.headers)
			target.headers = {};
		copyDefaults(target.headers, defaults.headers);
	}
}

// Executes an HTTP request to our context
//  - uses additional parameters on the request options:
//    - noretry: bool, should the url resolve fail automatically if it previously failed?
Agent.prototype.dispatch = function(req) {
	if (!req) req = {};
	if (!req.headers) req.headers = {};
	var self = this;

	if (this.requestDefaults)
		copyDefaults(req, this.requestDefaults);

	// If given a request, streaming may occur. Suspend events on the request until resolved, as the dispatcher wont wire up until after resolution.
	if (req instanceof Request) {
		req.suspendEvents();
	}

	// Resolve our target URL
	return ((req.url) ? promise(req.url) : this.resolve({ noretry: req.noretry, nohead: true }))
		.succeed(function(url) {
			req.url = url;
			var res_ = dispatch(req);
			if (req instanceof Request) {
				req.resumeEvents();
			}
			return res_;
		})
		.succeed(function(res) {
			// After every successful request, update our links and mark our context as good (in case it had been bad)
			self.context.setResolved();
			if (res.parsedHeaders.link) self.links = res.parsedHeaders.link;
			else self.links = self.links || []; // cache an empty link list so we dont keep trying during resolution
			self.proxyTmpl = (res.header('Proxy-Tmpl')) ? res.header('Proxy-Tmpl').split(' ') : null;
			return res;
		})
		.fail(function(res) {
			// Let a 1 or 404 indicate a bad context (as opposed to some non-navigational error like a bad request body)
			if (res.status === constants.LINK_NOT_FOUND || res.status === 404)
				self.context.setFailed(res);
			throw res;
		});
};

// Executes a GET text/event-stream request to our context
Agent.prototype.subscribe = function(req) {
	var self = this;
	var eventStream;
	if (!req) req = {};
	return this.resolve({ nohead: true }).succeed(function(url) {
		req.url = url;

		if (self.requestDefaults)
			copyDefaults(req, self.requestDefaults);

		eventStream = subscribe(req);
		return eventStream.response_;
	}).then(function() {
		return eventStream;
	});
};

// Follows a link relation from our context, generating a new agent
// - `query` may be:
//   - an object in the same form of a `local.queryLink()` parameter
//   - an array of link query objects (to be followed sequentially)
//   - a URI string
//     - if using the 'nav:' scheme, will convert the URI into a link query object
//     - if a relative URI using the HTTP/S/L scheme, will follow the relation relative to the current context
//     - if an absolute URI using the HTTP/S/L scheme, will go to that URI
// - uses URI Templates to generate URLs
// - when querying, only the `rel` and `id` (if specified) attributes must match
//   - the exception to this is: `rel` matches and the HREF has an {id} token
//   - all other attributes are used to fill URI Template tokens and are not required to match
Agent.prototype.follow = function(query) {
	// convert nav: uri to a query array
	if (typeof query == 'string' && helpers.isNavSchemeUri(query))
		query = helpers.parseNavUri(query);

	// make sure we always have an array
	if (!Array.isArray(query))
		query = [query];

	// build a full follow() chain
	var nav = this;
	do {
		nav = new Agent(new AgentContext(query.shift()), nav);
		if (this.requestDefaults)
			nav.setRequestDefaults(this.requestDefaults);
	} while (query[0]);

	return nav;
};

// Resets the agent's resolution state, causing it to reissue HEAD requests (relative to any parent agents)
Agent.prototype.unresolve = function() {
	this.context.resetResolvedState();
	this.links = null;
	this.proxyTmpl = null;
	return this;
};

// Reassigns the agent to a new absolute URL
// - `url`: required string, the URL to rebase the agent to
// - resets the resolved state
Agent.prototype.rebase = function(url) {
	this.unresolve();
	this.context.query = url;
	this.context.queryIsAbsolute = true;
	this.context.url  = url;
	this.context.urld = helpers.parseUri(url);
	return this;
};

// Resolves the agent's URL, reporting failure if a link or resource is unfound
//  - also ensures the links have been retrieved from the context
//  - may trigger resolution of parent contexts
//  - options is optional and may include:
//    - noretry: bool, should the url resolve fail automatically if it previously failed?
//    - nohead: bool, should we issue a HEAD request once we have a URL? (not favorable if planning to dispatch something else)
//  - returns a promise which will fulfill with the resolved url
Agent.prototype.resolve = function(options) {
	var self = this;
	options = options || {};

	var nohead = options.nohead;
	delete options.nohead;
	// ^ pull `nohead` out so that parent resolves are `nohead: false` - we do want them to dispatch HEAD requests to resolve us

	var resolvePromise = promise();
	if (this.links !== null && (this.context.isResolved() || (this.context.isAbsolute() && this.context.isBad() === false))) {
		// We have links and we were previously resolved (or we're absolute so there's no need)
		resolvePromise.fulfill(this.context.getUrl());
	} else if (this.context.isBad() === false || (this.context.isBad() && !options.noretry)) {
		// We don't have links, and we haven't previously failed (or we want to try again)
		this.context.resetResolvedState();

		if (this.context.isRelative() && !this.parentAgent) {
			// Scheme-less URIs can map to local URIs, so make sure the local server hasnt been added since we were created
			if (typeof this.context.query == 'string' && !!httpl.getServer(this.context.query)) {
				self.context = new AgentContext(self.context.query);
			} else {
				self.context.setFailed({ status: 404, reason: 'not found' });
				resolvePromise.reject(this.context.getError());
				return resolvePromise;
			}
		}

		if (this.context.isRelative()) {
			// Up the chain we go
			resolvePromise = this.parentAgent.resolve(options)
				.succeed(function() {
					// Parent resolved, query its links
					var childUrl = self.parentAgent.lookupLink(self.context);
					if (childUrl) {
						// We have a pope! I mean, link.
						self.context.setResolved(childUrl);

						// Send a HEAD request to get our links
						if (nohead) // unless dont
							return childUrl;
						return self.dispatch({ method: 'HEAD', url: childUrl })
							.succeed(function() { return childUrl; }); // fulfill resolvePromise afterward
					}

					// Error - Link not found
					var response = new Response();
					response.writeHead(constants.LINK_NOT_FOUND, 'Link Query Failed to Match').end();
					throw response;
				})
				.fail(function(error) {
					self.context.setFailed(error);
					throw error;
				});
		} else {
			// At the top of the chain already
			if (nohead)
				resolvePromise.fulfill(self.context.getUrl());
			else {
				resolvePromise = this.dispatch({ method: 'HEAD', url: self.context.getUrl() })
					.succeed(function(res) { return self.context.getUrl(); });
			}
		}
	} else {
		// We failed in the past and we don't want to try again
		resolvePromise.reject(this.context.getError());
	}
	return resolvePromise;
};

// Looks up a link in the cache and generates the URI (the follow logic)
Agent.prototype.lookupLink = function(context) {
	if (context.query) {
		if (typeof context.query == 'object') {
			// Try to find a link that matches
			var link = helpers.queryLinks(this.links, context.query)[0];
			if (link) {
				var uri = UriTemplate.parse(link.href).expand(context.query);
				if (this.proxyTmpl && !link.noproxy)
					uri = helpers.makeProxyUri(uri, this.proxyTmpl);
				return uri;
			}
		}
		else if (typeof context.query == 'string') {
			// A URL
			if (!helpers.isAbsUri(context.query))
				return helpers.joinRelPath(this.context.urld, context.query);
			return context.query;
		}
	}
	console.log('Failed to find a link to resolve context. Link query:', context.query, 'Agent:', this);
	return null;
};

// Dispatch Sugars
// ===============
function makeDispSugar(method) {
	return function(options) {
		var req = options || {};
		req.method = method;
		return this.dispatch(req);
	};
}
function makeDispWBodySugar(method) {
	return function(body, options) {
		var req = options || {};
		req.method = method;
		req.body = body;
		return this.dispatch(req);
	};
}
Agent.prototype.SUBSCRIBE = makeDispSugar('SUBSCRIBE');
Agent.prototype.HEAD   = Agent.prototype.head   = makeDispSugar('HEAD');
Agent.prototype.GET    = Agent.prototype.get    = makeDispSugar('GET');
Agent.prototype.DELETE = Agent.prototype.delete = makeDispSugar('DELETE');
Agent.prototype.POST   = Agent.prototype.post   = makeDispWBodySugar('POST');
Agent.prototype.PUT    = Agent.prototype.put    = makeDispWBodySugar('PUT');
Agent.prototype.PATCH  = Agent.prototype.patch  = makeDispWBodySugar('PATCH');
Agent.prototype.NOTIFY = Agent.prototype.notify = makeDispWBodySugar('NOTIFY');

// Builder
// =======
var agent = function(query) {
	if (query instanceof Agent)
		return query;

	// convert nav: uri to a query array
	if (typeof query == 'string' && helpers.isNavSchemeUri(query))
		query = helpers.parseNavUri(query);

	// make sure we always have an array
	if (!Array.isArray(query))
		query = [query];

	// build a full follow() chain
	var nav = new Agent(new AgentContext(query.shift()));
	while (query[0]) {
		nav = new Agent(new AgentContext(query.shift()), nav);
	}

	return nav;
};

module.exports = {
	Agent: Agent,
	agent: agent
};
},{"../constants.js":2,"../promises.js":4,"../util":9,"./dispatch.js":13,"./helpers.js":14,"./httpl.js":16,"./request.js":18,"./response.js":19,"./subscribe.js":23,"./uri-template.js":24}],11:[function(require,module,exports){
var Request = require('./request.js');
var Response = require('./response.js');
var Server = require('./server.js');
var contentTypes = require('./content-types.js');

// BridgeServer
// ============
// EXPORTED
// Core type for all servers which pipe requests between separated namespaces (eg WorkerBridgeServer, RTCBridgeServer)
// - Should be used as a prototype
// - Provides HTTPL implementation using the channel methods (which should be overridden by the subclasses)
// - Underlying channel must be:
//   - reliable
//   - order-guaranteed
// - Underlying channel is assumed not to be:
//   - multiplexed
// - :NOTE: WebRTC's SCTP should eventually support multiplexing, in which case RTCBridgeServer should
//   abstract multiple streams into the one "channel" to prevent head-of-line blocking
function BridgeServer(config) {
	Server.call(this, config);

	this.sidCounter = 1;
	this.incomingStreams = {}; // maps sid -> request/response stream
	// ^ only contains active streams (closed streams are deleted)
	this.incomingStreamsBuffer = {}; // maps sid -> {nextMid:, cache:{}}
	this.outgoingStreams = {}; // like `incomingStreams`, but for requests & responses that are sending out data
	this.msgBuffer = []; // buffer of messages kept until channel is active
	this.isReorderingMessages = false;
}
BridgeServer.prototype = Object.create(Server.prototype);
module.exports = BridgeServer;

// Turns on/off message numbering and the HOL-blocking reorder protocol
BridgeServer.prototype.useMessageReordering = function(v) {
	this.debugLog('turning '+(v?'on':'off')+' reordering');
	this.isReorderingMessages = !!v;
};

// Returns true if the channel is ready for activity
// - should be overridden
// - returns boolean
BridgeServer.prototype.isChannelActive = function() {
	console.warn('isChannelActive not defined', this);
	return false;
};

// Sends a single message across the channel
// - should be overridden
// - `msg`: required string
BridgeServer.prototype.channelSendMsg = function(msg) {
	console.warn('channelSendMsg not defined', this, msg);
};

// Remote request handler
// - should be overridden
BridgeServer.prototype.handleRemoteRequest = function(request, response) {
	console.warn('handleRemoteRequest not defined', this);
	response.writeHead(501, 'server not implemented');
	response.end();
};

// Sends messages that were buffered while waiting for the channel to setup
// - should be called by the subclass if there's any period between creation and channel activation
BridgeServer.prototype.flushBufferedMessages = function() {
	this.debugLog('FLUSHING MESSAGES', this, JSON.stringify(this.msgBuffer));
	this.msgBuffer.forEach(function(msg) {
		this.channelSendMsg(msg);
	}, this);
	this.msgBuffer.length = 0;
};

// Helper which buffers messages when the channel isnt active
BridgeServer.prototype.channelSendMsgWhenReady = function(msg) {
	if (!this.isChannelActive()) {
		// Buffer messages if not ready
		this.msgBuffer.push(msg);
	} else {
		this.channelSendMsg(msg);
	}
};

// Local request handler
// - pipes the request directly to the remote namespace
BridgeServer.prototype.handleLocalRequest = function(request, response) {
	// Build message
	var sid = this.sidCounter++;
	var query_part = contentTypes.serialize('application/x-www-form-urlencoded', request.query);
	var msg = {
		sid: sid,
		mid: (this.isReorderingMessages) ? 1 : undefined,
		method: request.method,
		path: request.path + ((query_part) ? ('?'+query_part) : ''),
		headers: request.headers
	};

	// Hold onto streams
	this.outgoingStreams[msg.sid] = request;
	this.incomingStreams[-msg.sid] = response; // store response stream in anticipation of the response messages

	// Send over the channel
	this.channelSendMsgWhenReady(JSON.stringify(msg));

	// Wire up request stream events
	var this2 = this;
	var midCounter = msg.mid;
	request.on('data',  function(data) { this2.channelSendMsgWhenReady(JSON.stringify({ sid: sid, mid: (midCounter) ? ++midCounter : undefined, body: data })); });
	request.on('end', function()       { this2.channelSendMsgWhenReady(JSON.stringify({ sid: sid, mid: (midCounter) ? ++midCounter : undefined, end: true })); });
	request.on('close', function()     {
		this2.channelSendMsgWhenReady(JSON.stringify({ sid: sid, mid: (midCounter) ? ++midCounter : undefined, close: true }));
		delete this2.outgoingStreams[msg.sid];
	});
};

// Called before server destruction
// - may be overridden
// - executes syncronously; does not wait for cleanup to finish
BridgeServer.prototype.terminate = function(status, reason) {
	status = status || 503;
	reason = reason || 'Service Unavailable';
	Server.prototype.terminate.call(this);
	for (var sid in this.incomingStreams) {
		if ((this.incomingStreams[sid] instanceof Response) && !this.incomingStreams[sid].status) {
			this.incomingStreams[sid].writeHead(status, reason);
		}
		this.incomingStreams[sid].end();
	}
	for (sid in this.outgoingStreams) {
		if ((this.outgoingStreams[sid] instanceof Response) && !this.outgoingStreams[sid].status) {
			this.outgoingStreams[sid].writeHead(status, reason);
		}
		this.outgoingStreams[sid].end();
	}
	this.incomingStreams = {};
	this.outgoingStreams = {};
};

// HTTPL implementation for incoming messages
// - should be called by subclasses on incoming messages
BridgeServer.prototype.onChannelMessage = function(msg) {
	// Validate and parse JSON
	if (typeof msg == 'string') {
		if (!validateJson(msg)) {
			console.warn('Dropping malformed HTTPL message', msg, this);
			return;
		}
		msg = JSON.parse(msg);
	}
	if (!validateHttplMessage(msg)) {
		console.warn('Dropping malformed HTTPL message', msg, this);
		return;
	}

	// Do input buffering if the message is numbered
	if (msg.mid) {
		// Create the buffer
		if (!this.incomingStreamsBuffer[msg.sid]) {
			this.incomingStreamsBuffer[msg.sid] = {
				nextMid: 1,
				cache: {}
			};
		}
		// Cache (block at HOL) if not next in line
		if (this.incomingStreamsBuffer[msg.sid].nextMid != msg.mid) {
			this.incomingStreamsBuffer[msg.sid].cache[msg.mid] = msg;
			return;
		}
	}

	// Get/create stream
	var stream = this.incomingStreams[msg.sid];
	if (!stream) {
		// Incoming requests have a positive sid
		if (msg.sid > 0) {
			// Extracy query
			var query = null;
			var pathparts = (msg.path||'').split('?');
			msg.path = pathparts[0];
			if (pathparts[1]) {
				query = contentTypes.deserialize('application/x-www-form-urlencoded', pathparts[1]);
			}

			// Create request & response
			var request = new Request({
				method: msg.method,
				path: msg.path,
				query: query,
				headers: msg.headers
			});
			request.deserializeHeaders();
			var response = new Response();
			request.on('close', function() { response.close(); });

			// Wire response into the stream
			var this2 = this;
			var resSid = -(msg.sid);
			var midCounter = (this.isReorderingMessages) ? 1 : undefined;
			response.on('headers', function() {
				this2.channelSendMsg(JSON.stringify({
					sid: resSid,
					mid: (midCounter) ? midCounter++ : undefined,
					status: response.status,
					reason: response.reason,
					headers: response.headers,
				}));
			});
			response.on('data',  function(data) {
				this2.channelSendMsg(JSON.stringify({ sid: resSid, mid: (midCounter) ? midCounter++ : undefined, body: data }));
			});
			response.on('end', function() {
				this2.channelSendMsg(JSON.stringify({ sid: resSid, mid: (midCounter) ? midCounter++ : undefined, end: true }));
			});
			response.on('close', function() {
				this2.channelSendMsg(JSON.stringify({ sid: resSid, mid: (midCounter) ? midCounter++ : undefined, close: true }));
				delete this2.outgoingStreams[resSid];
			});

			// Hold onto the streams
			stream = this.incomingStreams[msg.sid] = request;
			this.outgoingStreams[resSid] = response;

			// Pass on to the request handler
			this.handleRemoteRequest(request, response);
		}
		// Incoming responses have a negative sid
		else {
			// There should have been an incoming stream
			// (incoming response streams are created locally on remote request dispatches)
			console.warn('Dropping unexpected HTTPL response message', msg, this);
			return;
		}
	}

	// {status: [int]} -> write head
	if (msg.sid < 0 && typeof msg.status != 'undefined') {
		stream.writeHead(msg.status, msg.reason, msg.headers);
	}

	// {body: [String]} -> write to stream body
	if (msg.body) {
		stream.write(msg.body);
	}

	// {end: true} -> end stream
	if (msg.end) {
		stream.end();
	}

	// {close: true} -> close stream
	if (msg.close) {
		stream.close();
		delete this.incomingStreams[msg.sid];
		delete this.incomingStreamsBuffer[msg.sid];
		return;
	}

	// Check the cache if the message is numbered for reordering
	if (msg.mid) {
		// Is the next message cached?
		var nextmid = ++this.incomingStreamsBuffer[msg.sid].nextMid;
		if (this.incomingStreamsBuffer[msg.sid].cache[nextmid]) {
			// Process it now
			var cachedmsg = this.incomingStreamsBuffer[msg.sid].cache[nextmid];
			delete this.incomingStreamsBuffer[msg.sid].cache[nextmid];
			this.onChannelMessage(cachedmsg);
		}
	}
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
},{"./content-types.js":12,"./request.js":18,"./response.js":19,"./server.js":22}],12:[function(require,module,exports){
// contentTypes
// ============
// EXPORTED
// provides serializers and deserializers for MIME types
var contentTypes = {
	serialize   : contentTypes__serialize,
	deserialize : contentTypes__deserialize,
	register    : contentTypes__register
};
var contentTypes__registry = {};
module.exports = contentTypes;

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
},{}],13:[function(require,module,exports){
var util = require('../util');
var helpers = require('./helpers.js');
var schemes = require('./schemes.js');
var Request = require('./request.js');
var Response = require('./response.js');
var contentTypes = require('./content-types.js');

var webDispatchWrapper;

// dispatch()
// ==========
// EXPORTED
// HTTP request dispatcher
// - `request` param:
//   - if string, creates GET request for json
//   - if object, requires `url`, sends immediately (so you cant stream request body)
//   - if Response, leaves you to run write() and end() (so you can stream request body)
// - `request.query`: optional object, additional query params
// - `request.headers`: optional object
// - `request.body`: optional request body
// - `request.stream`: optional boolean, stream the response? If falsey, will buffer and deserialize the response
// - `request.binary`: optional boolean, receive a binary arraybuffer response? Only applies to HTTP/S
// - returns a `Promise` object
//   - on success (status code 2xx), the promise is fulfilled with a `ClientResponse` object
//   - on failure (status code 4xx,5xx), the promise is rejected with a `ClientResponse` object
//   - all protocol (status code 1xx,3xx) is handled internally
function dispatch(request) {
	if (!request) { throw new Error("No request provided to dispatch()"); }
	if (typeof request == 'string')
		request = { url: request };

	// Create the request if needed
	var body = null, shouldAutoSendRequestBody = false;
	if (!(request instanceof Request)) {
		shouldAutoSendRequestBody = true; // we're going to end() with req.body

		var timeout = request.timeout;
		request = new Request(request);
		if (timeout) { request.setTimeout(timeout); } // :TODO: should this be in the request constructor?

		// pull out body for us to send
		body = request.body;
		request.body = '';
	}
	if (!request.url) { throw new Error("No url on request"); }

	// If given a nav: scheme, spawn a agent to handle it
	var scheme = parseScheme(request.url);
	if (scheme == 'nav') {
		var request2 = new Request(request); // clone before modifying
		var url = request2.url;
		delete request2.url;
		var response_ = require('./agent.js').agent(url).dispatch(request2);
		request.on('data', request2.write.bind(request2));
		request.on('end', request2.end.bind(request2));
		if (shouldAutoSendRequestBody) request.end(body);
		return response_;
	}

	// Prep request
	Object.defineProperty(request, 'urld', { value: helpers.parseUri(request.url), configurable: true, enumerable: false, writable: true }); // (urld = url description)
	if (request.urld.query) {
		// Extract URL query parameters into the request's query object
		var q = contentTypes.deserialize('application/x-www-form-urlencoded', request.urld.query);
		for (var k in q)
			request.query[k] = q[k];
		request.urld.relative = request.urld.path + ((request.urld.anchor) ? ('#'+request.urld.anchor) : '');
		request.url = scheme+'://'+request.urld.authority+request.urld.relative;
	}
	request.serializeHeaders();

	// Setup response object
	var requestStartTime;
	var response = new Response();
	var response_ = require('../promises.js').promise();
	request.on('close', function() { response.close(); });
	response.on('headers', function() {
		response.deserializeHeaders();
		response.processHeaders(request);
	});
	response.on('close', function() {
		// Track latency
		response.latency = Date.now() - requestStartTime;
		// Close the request
		request.close();
	});
	if (request.stream) {
		// streaming, fulfill on 'headers'
		response.on('headers', function(response) {
			fulfillResponsePromise(response_, response);
		});
	} else {
		// buffering, fulfill on 'close'
		response.on('close', function() {
			fulfillResponsePromise(response_, response);
		});
	}

	// Suspend events until the scheme handler gets a chance to wire up
	// (allows async to occur in the webDispatchWrapper)
	request.suspendEvents();
	response.suspendEvents();

	// Create function to be called by the dispatch wrapper
	var dispatchFn = function(request, response, schemeHandler) {
		// execute by scheme
		requestStartTime = Date.now();
		schemeHandler = schemeHandler || schemes.get(scheme);
		if (!schemeHandler) {
			response.writeHead(0, 'unsupported scheme "'+scheme+'"');
			response.end();
			request.resumeEvents();
			response.resumeEvents();
		} else {
			// dispatch according to scheme
			schemeHandler(request, response);
			// now that the scheme handler has wired up, the spice must flow
			request.resumeEvents();
			response.resumeEvents();
			// autosend request body if not given a Request `request`
			if (shouldAutoSendRequestBody) { request.end(body); }
		}
		return response_;
	};

	// Setup the arguments list for the dispatch wrapper to include any additional params passed to dispatch()
	// aka (request, response, dispatch, args...)
	// this allows apps to do something like dispatch(request, extraParam1, extraParam2) and have the dispatch wrapper use those params
	var args = Array.prototype.slice.call(arguments, 1);
	args.unshift(dispatchFn);
	args.unshift(response);
	args.unshift(request);

	// Wait until next tick, to make sure dispatch() is always async
	util.nextTick(function() {
		// Allow the wrapper to audit the message
		webDispatchWrapper.apply(null, args);
	});

	response_.request = request;
	return response_;
}

// EXPORTED
// fulfills/reject a promise for a response with the given response
// - exported because its pretty useful
function fulfillResponsePromise(p, response) {
	// wasnt streaming, fulfill now that full response is collected
	if (response.status >= 200 && response.status < 400)
		p.fulfill(response);
	else if (response.status >= 400 && response.status < 600 || response.status === 0)
		p.reject(response);
	else
		p.fulfill(response); // :TODO: 1xx protocol handling
}

// EXPORTED
function setDispatchWrapper(wrapperFn) {
	webDispatchWrapper = wrapperFn;
}

setDispatchWrapper(function(request, response, dispatch) {
	dispatch(request, response);
});

// INTERNAL
function parseScheme(url) {
	var schemeMatch = /^([^.^:]*):/.exec(url);
	if (!schemeMatch) {
		// shorthand/default schemes
		if (url.indexOf('//') === 0)
			return 'http';
		else if (url.indexOf('||') === 0)
			return 'nav';
		else
			return 'httpl';
	}
	return schemeMatch[1];
}


function makeDispSugar(method) {
	return function(options) {
		var req = options || {};
		if (typeof req == 'string') {
			req = { url: req };
		}
		req.method = method;
		return dispatch(req);
	};
}
function makeDispWBodySugar(method) {
	return function(body, options) {
		var req = options || {};
		if (typeof req == 'string') {
			req = { url: req };
		}
		req.method = method;
		req.body = body;
		return dispatch(req);
	};
}

module.exports = {
	dispatch: dispatch,
	fulfillResponsePromise: fulfillResponsePromise,
	setDispatchWrapper: setDispatchWrapper,

	SUBSCRIBE: makeDispSugar('SUBSCRIBE'),
	HEAD:      makeDispSugar('HEAD'),
	GET:       makeDispSugar('GET'),
	DELETE:    makeDispSugar('DELETE'),
	POST:      makeDispWBodySugar('POST'),
	PUT:       makeDispWBodySugar('PUT'),
	PATCH:     makeDispWBodySugar('PATCH'),
	NOTIFY:    makeDispWBodySugar('NOTIFY'),
};
},{"../promises.js":4,"../util":9,"./agent.js":10,"./content-types.js":12,"./helpers.js":14,"./request.js":18,"./response.js":19,"./schemes.js":21}],14:[function(require,module,exports){
// Helpers
// =======

var httpHeaders = require('./http-headers.js');
var promise = require('../promises.js').promise;
var UriTemplate = require('./uri-template.js');

// EXPORTED
// takes parsed a link header and a query object, produces an array of matching links
// - `links`: [object]/object, either the parsed array of links or the request/response object
// - `query`: object
function queryLinks(links, query) {
	if (!links) return [];
	if (links.parsedHeaders) links = links.parsedHeaders.link; // actually a request or response object
	if (!Array.isArray(links)) return [];
	return links.filter(function(link) { return queryLink(link, query); });
}

// EXPORTED
// takes parsed link and a query object, produces boolean `isMatch`
// - `query`: object, keys are attributes to test, values are values to test against (strings)
//            eg { rel: 'foo bar', id: 'x' }
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
			.map(function(type) { return [type, getMediaTypePriority(type, accept)]; })
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
// - eg http://foo.com, //foo.com, httpl://bar.app
var hasSchemeRegex = /^((http(s|l)?:)?\/\/)|((nav:)?\|\|)|(data:)/;
function isAbsUri(url) {
	// Has a scheme?
	if (hasSchemeRegex.test(url))
		return true;
	// No scheme, is it a local server or a global URI?
	var urld = parseUri(url);
	return !!require('./httpl.js').getServer(urld.authority) || !!parsePeerDomain(urld.authority);
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
			protocol = 'httpl://';
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

	// handle peer-uris specially
	if (str.indexOf('!') !== -1) {
		var schemeSepI = str.indexOf('//');
		var firstSlashI = str.indexOf('/', schemeSepI+2);
		var peerdomain = str.slice((schemeSepI !== -1) ? schemeSepI+2 : 0, (firstSlashI !== -1) ? firstSlashI : str.length);
		var peerd = parsePeerDomain(peerdomain);
		if (peerd) {
			var urld = {};
			if (firstSlashI !== -1 && str.slice(firstSlashI)) {
				urld = parseUri(str.slice(firstSlashI));
			}
			urld.protocol = 'httpl';
			urld.host = urld.authority = peerdomain;
			urld.port = urld.password = urld.user = urld.userInfo = '';
			urld.source = str;
			return urld;
		}
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
// breaks a peer domain into its constituent parts
// - returns { user:, relay:, app:, sid: }
var peerDomainRE = /^(.+)@([^!]+)!([^!\/]+)(?:!([\d]+))?$/i;
function parsePeerDomain(domain) {
	var match = peerDomainRE.exec(domain);
	if (match) {
		return {
			domain: domain,
			user: match[1],
			relay: match[2],
			provider: match[2], // :TODO: remove
			app: match[3],
			stream: match[4] || 0, // :TODO: remove
			sid: match[4] || 0
		};
	}
	return null;
}

// EXPORTED
// constructs a peer domain from its constituent parts
// - returns string
function makePeerDomain(user, relay, app, sid) {
	return user+'@'+relay+'!'+app+((sid) ? '!'+sid : '');
}

// EXPORTED
// builds a proxy URI out of an array of templates
// eg ('httpl://my_worker.js/', ['httpl://0.page/{uri}', 'httpl://foo/{?uri}'])
// -> "httpl://0.page/httpl%3A%2F%2Ffoo%2F%3Furi%3Dhttpl%253A%252F%252Fmy_worker.js%252F"
function makeProxyUri(uri, templates) {
	if (!Array.isArray(templates)) templates = [templates];
	for (var i=templates.length-1; i >= 0; i--) {
		var tmpl = templates[i];
		uri = UriTemplate.parse(tmpl).expand({ uri: uri });
	}
	return uri;
}

// EXPORTED
// sends the given response back verbatim
// - if `writeHead` has been previously called, it will not change
// - params:
//   - `target`: the response to populate
//   - `source`: the response to pull data from
//   - `headersCb`: (optional) takes `(headers)` from source and responds updated headers for target
//   - `bodyCb`: (optional) takes `(body)` from source and responds updated body for target
function pipe(target, source, headersCB, bodyCb) {
	headersCB = headersCB || function(v) { return v; };
	bodyCb = bodyCb || function(v) { return v; };
	return promise(source)
		.always(function(source) {
			if (!target.status) {
				// copy the header if we don't have one yet
				target.writeHead(source.status, source.reason, headersCB(source.headers));
			}
			if (source.body !== null && typeof source.body != 'undefined') { // already have the body?
				target.write(bodyCb(source.body));
			}
			if (source.on && source.isConnOpen) {
				// wire up the stream
				source.on('data', function(data) {
					target.write(bodyCb(data));
				});
				source.on('end', function() {
					target.end();
				});
			} else {
				target.end();
			}
			return target;
		});
}

// EXPORTED
// modifies XMLHttpRequest to support HTTPL
function patchXHR() {
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
		if (urld.protocol != 'httpl') {
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
}

module.exports = {
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
	parsePeerDomain: parsePeerDomain,
	makePeerDomain: makePeerDomain,
	makeProxyUri: makeProxyUri,

	pipe: pipe,

	patchXHR: patchXHR
};
},{"../promises.js":4,"./dispatch.js":13,"./http-headers.js":15,"./httpl.js":16,"./request.js":18,"./uri-template.js":24}],15:[function(require,module,exports){
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

/*
Via =  "Via" ":" 1#( received-protocol received-by [ comment ] )
received-protocol = [ protocol-name "/" ] protocol-version
protocol-name     = token
protocol-version  = token
received-by       = ( host [ ":" port ] ) | pseudonym
pseudonym         = token
*/
//                  proto-name  proto-v   received-by        comment
//                  ------      -------   --------------     ------
var viaregex = /(?:([A-z]+)\/)?([\d\.]+) ([-A-z:\d\.@!]*)(?: ([^,]+))?/g;
httpHeaders.register('via',
	function (obj) {
		return obj.map(function(via) {
			return ((via.proto.name) ? (via.proto.name+'/') : '') + via.proto.version+' '+via.hostname+((via.comment) ? (' '+via.comment) : '');
		}).join(', ');
	},
	function (str) {
		var vias = [], match;
		while ((match = viaregex.exec(str))) {
			var via = { proto: { name: (match[1]||'http'), version: match[2] }, hostname: match[3], comment: match[4] };
			vias.push(via);
		}
		return vias;
	}
);
},{"./helpers.js":14}],16:[function(require,module,exports){
var schemes = require('./schemes.js');
var helpers = require('./helpers.js');
var contentTypes = require('./content-types.js');
var Server = require('./server.js');

// HTTPL
// =====
var hostLookupFn;
var localNotFoundServer = function(request, response) {
	response.writeHead(404, 'server not found');
	response.end();
};
var localRelayNotOnlineServer = function(request, response) {
	response.writeHead(407, 'peer relay not authenticated');
	response.end();
};
schemes.register('httpl', function(request, response) {
	// Find the local server
	var server = getServer(request.urld.authority);
	if (!server) {
		server = hostLookupFn(request, response);
		if (!server)
			server = localNotFoundServer;
	}

	// Deserialize the headers
	request.deserializeHeaders();

	// Pull out and standardize the path & host
	request.path = request.urld.path;
	request.headers.host = request.urld.authority;
	if (!request.path) request.path = '/'; // no path, give a '/'
	else request.path = request.path.replace(/(.)\/$/, '$1'); // otherwise, never end with a '/'

	// Pull out any query params in the path
	if (request.urld.query) {
		var query = contentTypes.deserialize('application/x-www-form-urlencoded', request.urld.query);
		if (!request.query) { request.query = {}; }
		for (var k in query) {
			request.query[k] = query[k];
		}
	}

	// Support warnings
	if (request.binary)
		console.warn('Got HTTPL request with binary=true - sorry, not currently supported', request);

	// Pass on to the server
	if (server.fn) {
		server.fn.call(server.context, request, response);
	} else if (server.handleLocalRequest) {
		server.handleLocalRequest(request, response);
	} else if (typeof server == 'function') {
		server(request, response);
	} else {
		throw "Invalid server";
	}
});

// EXPORTED
function setHostLookup(fn) {
	hostLookupFn = fn;
}

setHostLookup(function(req, res) {
	if (req.urld.srcPath) {
		// Try to load worker to handle response
		console.log('Spawning temporary worker', req.urld.authority);
		return require('../spawners.js').spawnWorkerServer(null, { domain: req.urld.authority, temp: true });
	}

	// Check if this is a peerweb URI
	var peerd = helpers.parsePeerDomain(req.urld.authority);
	if (peerd) {
		// See if this is a default stream miss
		if (peerd.sid == 0) {
			if (req.urld.authority.slice(-2) == '!0') {
				server = getServer(req.urld.authority.slice(0,-2));
			} else {
				req.urld.authority += '!0';
				server = getServer(req.urld.authority);
			}
		}
		if (!server) {
			// Not a default stream miss
			if (peerd.relay in __peer_relay_registry) {
				// Try connecting to the peer
				__peer_relay_registry[peerd.relay].connect(req.urld.authority);
				return getServer(req.urld.authority);
			} else {
				// We're not connected to the relay
				return localRelayNotOnlineServer;
			}
		}
	}
	return false;
});

// Local Server Registry
// =====================
var __httpl_registry = {};

// EXPORTED
function addServer(domain, server, serverContext) {
	if (__httpl_registry[domain]) throw new Error("server already registered at domain given to addServer");

	var isServerObj = (server instanceof Server);
	if (isServerObj) {
		serverContext = server;
		server = server.handleLocalRequest;
		serverContext.config.domain = domain;
	}

	__httpl_registry[domain] = { fn: server, context: serverContext };
	return __httpl_registry[domain];
}

// EXPORTED
function removeServer(domain) {
	if (__httpl_registry[domain]) {
		delete __httpl_registry[domain];
	}
}

// EXPORTED
function getServer(domain) {
	return __httpl_registry[domain];
}

// EXPORTED
function getServers() {
	return __httpl_registry;
}


// Local Relay Registry
// ====================
var __peer_relay_registry = {};

// EXPORTED
function addRelay(domain, relay) {
	__peer_relay_registry[domain] = relay;
}

// EXPORTED
function removeRelay(domain) {
	if (__peer_relay_registry[domain]) {
		delete __peer_relay_registry[domain];
	}
}

// EXPORTED
function getRelay(domain) {
	return __peer_relay_registry[domain];
}

// EXPORTED
function getRelays() {
	return __peer_relay_registry;
}

module.exports = {
	addServer: addServer,
	removeServer: removeServer,
	getServer: getServer,
	getServers: getServers,

	addRelay: addRelay,
	removeRelay: removeRelay,
	getRelay: getRelay,
	getRelays: getRelays,

	setHostLookup: setHostLookup
};
},{"../spawners.js":6,"./content-types.js":12,"./helpers.js":14,"./schemes.js":21,"./server.js":22}],17:[function(require,module,exports){
var util = require('../util');
var helpers = require('./helpers.js');
var httpl = require('./httpl.js');
var agent = require('./agent.js').agent;
var RTCBridgeServer = require('./rtc-bridge-server.js');


function randomStreamId() {
	return Math.round(Math.random()*10000);
}

// Relay
// =====
// EXPORTED
// Helper class for managing a peer web relay provider
// - `config.provider`: optional string, the relay provider
// - `config.serverFn`: optional function, the function for peerservers' handleRemoteRequest
// - `config.app`: optional string, the app to join as (defaults to window.location.host)
// - `config.sid`: optional number, the stream id (defaults to pseudo-random)
// - `config.ping`: optional number, sends a ping to self via the relay at the given interval (in ms) to keep the stream alive
//   - set to false to disable keepalive pings
//   - defaults to 45000
// - `config.retryTimeout`: optional number, time (in ms) before a peer connection is aborted and retried (defaults to 15000)
// - `config.retries`: optional number, number of times to retry a peer connection before giving up (defaults to 5)
// - `config.log`: optional bool, enables logging of all message traffic and webrtc connection processes
function Relay(config) {
	if (!config) config = {};
	if (!config.app) config.app = window.location.host;
	if (typeof config.sid == 'undefined') { config.sid = randomStreamId(); this.autoRetryStreamTaken = true; }
	if (typeof config.ping == 'undefined') { config.ping = 45000; }
	this.config = config;
	util.mixinEventEmitter(this);

	// State
	this.assignedDomain = null;
	this.connectionStatus = 0;
	Object.defineProperty(this, 'connectedToRelay', {
		get: function() { return this.connectionStatus == Relay.CONNECTED; },
		set: function(v) { this.connectionStatus = (v) ? Relay.CONNECTED : Relay.DISCONNECTED; }
	});
	this.userId = null;
	this.accessToken = null;
	this.bridges = {};
	this.pingInterval = null;
	this.registeredLinks = null;
	this.relayEventStream = null;

	// Internal helpers
	this.messageFromAuthPopupHandler = null;

	// Agents
	this.relayService = null;
	this.usersCollection = null;
	this.relayItem = null;

	// Setup provider config
	if (config.provider) {
		this.setProvider(config.provider);
	}

	// Bind window close behavior
	window.addEventListener('beforeunload', this.onPageClose.bind(this));
}
module.exports = Relay;

// Constants
Relay.DISCONNECTED = 0;
Relay.CONNECTING   = 1;
Relay.CONNECTED    = 2;

// Sets the access token and triggers a connect flow
// - `token`: required String?, the access token (null if denied access)
// - `token` should follow the form '<userId>:<'
Relay.prototype.setAccessToken = function(token) {
	if (token == "null") token = null; // this happens sometimes when a bad token gets saved in localStorage
	if (token) {
		// Extract user-id from the access token
		var tokenParts = token.split(':');
		if (tokenParts.length !== 2) {
			throw new Error('Invalid access token');
		}

		// Store
		this.userId = tokenParts[0];
		this.accessToken = token;

		if (this.relayService) {
			this.relayService.setRequestDefaults({ headers: { authorization: 'Bearer '+token }});
			this.usersCollection.setRequestDefaults({ headers: { authorization: 'Bearer '+token }});

			// Try to validate our access now
			var self = this;
			this.relayItem = this.relayService.follow({
				rel: 'gwr.io/relay',
				user: this.getUserId(),
				app: this.getApp(),
				sid: this.getSid(),
				nc: Date.now() // nocache
			});
			this.relayItem.resolve().then( // a successful HEAD request will verify access
				function() {
					// Emit an event
					self.emit('accessGranted');
				},
				function(res) {
					// Handle error
					self.onRelayError({ event: 'error', data: res });
				}
			);
		}
	} else {
		// Update state and emit event
		var hadToken = !!this.accessToken;
		this.userId = null;
		this.accessToken = null;
		if (hadToken) {
			this.emit('accessRemoved');
		}
	}
};
Relay.prototype.isListening       = function() { return this.connectedToRelay; };
Relay.prototype.getAssignedDomain = function() { return this.assignedDomain; };
Relay.prototype.getAssignedUrl    = function() { return 'httpl://'+this.assignedDomain; };
Relay.prototype.getUserId         = function() { return this.userId; };
Relay.prototype.getApp            = function() { return this.config.app; };
Relay.prototype.setApp            = function(v) { this.config.app = v; };
Relay.prototype.getStreamId       = function() { return this.config.sid; };
Relay.prototype.getSid            = Relay.prototype.getStreamId;
Relay.prototype.setStreamId       = function(sid) { this.config.sid = sid; };
Relay.prototype.setSid            = Relay.prototype.setStreamId;
Relay.prototype.getAccessToken    = function() { return this.accessToken; };
Relay.prototype.getServer         = function() { return this.config.serverFn; };
Relay.prototype.setServer         = function(fn) { this.config.serverFn = fn; };
Relay.prototype.getRetryTimeout   = function() { return this.config.retryTimeout; };
Relay.prototype.setRetryTimeout   = function(v) { this.config.retryTimeout = v; };
Relay.prototype.getProvider       = function() { return this.config.provider; };
Relay.prototype.setProvider       = function(providerUrl) {
	// Abort if already connected
	if (this.connectedToRelay) {
		throw new Error("Can not change provider while connected to the relay. Call stopListening() first.");
	}
	// Update config
	this.config.provider = providerUrl;
	this.providerDomain = helpers.parseUri(providerUrl).authority;

	// Create APIs
	this.relayService = agent(this.config.provider);
	this.usersCollection = this.relayService.follow({ rel: 'gwr.io/users' });

	if (this.accessToken) {
		this.relayService.setRequestDefaults({ headers: { authorization: 'Bearer '+this.accessToken }});
		this.usersCollection.setRequestDefaults({ headers: { authorization: 'Bearer '+this.accessToken }});
	}
};

// Gets an access token from the provider & user using a popup
// - Best if called within a DOM click handler, as that will avoid popup-blocking
// - `opts.guestof`: optional string, the host userid providing the guest account. If specified, attempts to get a guest session
Relay.prototype.requestAccessToken = function(opts) {
	// Start listening for messages from the popup
	if (!this.messageFromAuthPopupHandler) {
		this.messageFromAuthPopupHandler = (function(e) {
			// Make sure this is from our popup
			var originUrld = helpers.parseUri(e.origin);
			var providerUrld = helpers.parseUri(this.config.provider);
			if (originUrld.authority !== providerUrld.authority) {
				return;
			}
			console.log('Received access token from '+e.origin);

			// Use this moment to switch to HTTPS, if we're using HTTP
			// - this occurs when the provider domain is given without a protocol, and the server is HTTPS
			// - failing to do so causes a redirect during the XHR calls to the relay, which violates a CORS condition
			if (this.config.provider != e.origin) {
				this.setProvider(e.origin);
			}

			// Update our token
			this.setAccessToken(e.data);

			// If given a null, emit denial event
			if (!e.data) {
				this.emit('accessDenied');
			}
		}).bind(this);
		window.addEventListener('message', this.messageFromAuthPopupHandler);
	}

	// Open interface in a popup
	// :HACK: because popup blocking can only be avoided by a syncronous popup call, we have to manually construct the url (it burns us)
	var url = this.getProvider() + '/session/' + this.config.app;
	if (opts && opts.guestof) { url += '?guestof='+encodeURIComponent(opts.guestof); }
	window.open(url);
};

// Fetches users from p2pw service
// - opts.online: optional bool, only online users
// - opts.trusted: optional bool, only users trusted by our session
Relay.prototype.getUsers = function(opts) {
	var api = this.usersCollection;
	if (opts) {
		opts.rel = 'self';
		api = api.follow(opts);
	}
	return api.get({ Accept: 'application/json' });
};

// Fetches a user from p2pw service
// - `userId`: string
Relay.prototype.getUser = function(userId) {
	return this.usersCollection.follow({ rel: 'gwr.io/user', id: userId }).get({ Accept: 'application/json' });
};

// Sends (or stores to send) links in the relay's registry
Relay.prototype.registerLinks = function(links) {
	this.registeredLinks = Array.isArray(links) ? links : [links];
	if (this.relayItem) {
		this.relayItem.dispatch({ method: 'PATCH', body: { links: this.registeredLinks }});
	}
};

// Creates a new agent with up-to-date links for the relay
Relay.prototype.agent = function() {
	if (this.relayService)
		return this.relayService.follow({ rel: 'gwr.io/relays', links: 1 });
	return agent();
};

// Subscribes to the event relay and begins handling signals
// - enables peers to connect
Relay.prototype.startListening = function() {
	var self = this;
	// Make sure we have an access token
	if (!this.getAccessToken()) {
		return;
	}
	if (this.connectionStatus !== Relay.DISCONNECTED) {
		console.error('startListening() called when already connected or connecting to relay. Must call stopListening() first.');
		return;
	}
	// Record our peer domain
	this.assignedDomain = this.makeDomain(this.getUserId(), this.config.app, this.config.sid);
	if (this.config.sid === 0) { this.assignedDomain += '!0'; } // full URI always
	// Connect to the relay stream
	this.relayItem = this.relayService.follow({
		rel: 'gwr.io/relay',
		user: this.getUserId(),
		app: this.getApp(),
		sid: this.getSid(),
		nc: Date.now() // nocache
	});
	this.connectionStatus = Relay.CONNECTING;
	this.relayItem.subscribe()
		.then(
			function(stream) {
				// Update state
				httpl.addRelay(self.providerDomain, self);
				self.relayEventStream = stream;
				self.connectionStatus = Relay.CONNECTED;
				stream.response_.then(function(response) {
					// Setup links
					if (self.registeredLinks) {
						// We had links stored from before, send them now
						self.registerLinks(self.registeredLinks);
					}

					// Emit event
					self.emit('listening');
					return response;
				});

				// Setup handlers
				stream.on('signal', self.onSignal.bind(self));
				stream.on('error', self.onRelayError.bind(self));
				stream.on('close', self.onRelayClose.bind(self));

				// Initiate the ping interval
				if (self.pingInterval) { clearInterval(self.pingInterval); }
				if (self.config.ping) {
					self.pingInterval = setInterval(function() {
						self.signal(self.getAssignedDomain(), { type: 'noop' });
					}, self.config.ping);
				}
			},
			function(err) {
				self.onRelayError({ event: 'error', data: err });
			}
		);
};

// Disconnects from the relay
// - peers will no longer be able to connect
Relay.prototype.stopListening = function() {
	if (this.connectedToRelay) {
		// Terminate any bridges that are mid-connection
		for (var domain in this.bridges) {
			if (this.bridges[domain].isConnecting) {
				this.bridges[domain].terminate();
			}
		}

		// Update state
		this.connectedToRelay = false;
		this.relayEventStream.close();
		this.relayEventStream = null;
		httpl.removeRelay(this.providerDomain);
	}
};

// Spawns an RTCBridgeServer and starts the connection process with the given peer
// - `peerUrl`: required String, the domain/url of the target peer
// - `config.initiate`: optional Boolean, should the server initiate the connection?
//   - defaults to true
//   - should only be false if the connection was already initiated by the opposite end
// - `config.retryTimeout`: optional number, time (in ms) before a connection is aborted and retried (defaults to 15000)
// - `config.retries`: optional number, number of times to retry before giving up (defaults to 5)
Relay.prototype.connect = function(peerUrl, config) {
	if (!config) config = {};
	if (typeof config.initiate == 'undefined') config.initiate = true;

	// Parse the url
	peerUrl = helpers.parseUri(peerUrl).authority;
	var peerd = helpers.parsePeerDomain(peerUrl);
	if (!peerd) {
		throw new Error("Invalid peer url given to connect(): "+peerUrl);
	}

	// Make sure the url has a stream id
	if (peerd.sid === 0 && peerUrl.slice(-2) != '!0') {
		peerUrl += '!0';
	}

	// Make sure we're not already connected
	if (peerUrl in this.bridges) {
		return this.bridges[peerUrl];
	}

	// Spawn new server
	console.log('Initiating WebRTC session with', peerUrl);
	var server = new RTCBridgeServer({
		peer:         peerUrl,
		initiate:     config.initiate,
		relay:        this,
		serverFn:     this.config.serverFn,
		loopback:     (peerUrl == this.assignedDomain),
		retryTimeout: config.retryTimeout || this.config.retryTimeout,
		retries:      config.retries || this.config.retries,
		log:          this.config.log || false
	});

	// Bind events
	server.on('connecting', this.emit.bind(this, 'connecting'));
	server.on('connected', this.emit.bind(this, 'connected'));
	server.on('disconnected', this.onBridgeDisconnected.bind(this));
	server.on('disconnected', this.emit.bind(this, 'disconnected'));
	server.on('error', this.emit.bind(this, 'error'));

	// Add to hostmap
	this.bridges[peerUrl] = server;
	httpl.addServer(peerUrl, server);

	return server;
};

Relay.prototype.signal = function(dst, msg) {
	if (!this.relayItem) {
		console.warn('Relay - signal() called before relay is connected');
		return;
	}
	var self = this;
	var response_ = this.relayItem.dispatch({ method: 'notify', body: { src: this.assignedDomain, dst: dst, msg: msg } });
	response_.fail(function(res) {
		if (res.status == 401) {
			if (!self.accessToken) {
				return;
			}
			// Remove bad access token to stop reconnect attempts
			self.setAccessToken(null);
			// Fire event
			self.emit('accessInvalid');
		}
	});
	return response_;
};

Relay.prototype.onSignal = function(e) {
	if (!e.data || !e.data.src || !e.data.msg) {
		console.warn('discarding faulty signal message', err);
	}
	if (e.data.msg.type == 'noop') { return; } // used for heartbeats to keep the stream alive

	// Find bridge that represents this origin
	var domain = e.data.src;
	var bridgeServer = this.bridges[domain] || this.bridges[domain + '!0'];

	// Does bridge exist?
	if (bridgeServer) {
		// Let bridge handle it
		bridgeServer.onSignal(e.data.msg);
	} else {
		if (e.data.msg.type == 'offer' || e.data.msg.type == 'httpl') {
			// Create a server to handle the signal
			bridgeServer = this.connect(domain, { initiate: false });
			bridgeServer.onSignal(e.data.msg);
		}
	}
};

Relay.prototype.onRelayError = function(e) {
	if (e.data && e.data.status == 423) { // locked
		// Update state
		this.relayEventStream = null;
		this.connectedToRelay = false;

		if (!this.autoRetryStreamTaken) {
			// Fire event
			this.emit('streamTaken');
		} else {
			// Auto-retry
			this.setSid(randomStreamId());
			this.startListening();
		}
	} else if (e.data && e.data.status == 420) { // out of streams
		// Update state
		this.relayEventStream = null;
		this.connectedToRelay = false;

		// Fire event
		this.emit('outOfStreams');
	} else if (e.data && (e.data.status == 401 || e.data.status == 403)) { // unauthorized
		// Remove bad access token to stop reconnect attempts
		this.setAccessToken(null);
		this.connectedToRelay = false;

		// Fire event
		this.emit('accessInvalid');
	} else if (e.data && (e.data.status === 0 || e.data.status == 404 || e.data.status >= 500)) { // connection lost, looks like server fault?
		// Update state
		if (this.connectedToRelay) {
			this.onRelayClose();
		}
		this.connectedToRelay = false;
		this.relayEventStream = null;

		// Attempt to reconnect in 2 seconds
		var self = this;
		setTimeout(function() {
			self.startListening();
			// Note - if this fails, an error will be rethrown and take us back here
		}, 2000);
	} else {
		// Fire event
		this.emit('error', { error: e.data });
	}
};

Relay.prototype.onRelayClose = function() {
	// Update state
	this.connectedToRelay = false;
	if (self.pingInterval) { clearInterval(self.pingInterval); }

	// Fire event
	this.emit('notlistening');
};

Relay.prototype.onBridgeDisconnected = function(data) {
	// Stop tracking bridges that close
	var bridge = this.bridges[data.domain];
	if (bridge) {
		delete this.bridges[data.domain];
		httpl.removeServer(data.domain);
	}
};

Relay.prototype.onPageClose = function() {
	var bridgeDomains = Object.keys(this.bridges);
	if (this.connectedToRelay && bridgeDomains.length !== 0) {
		// Collect connected peer destination info
		var dst = [];
		for (var domain in this.bridges) {
			dst.push(this.bridges[domain].config.peer);
		}

		// Send a synchronous disconnect signal to all connected peers
		var req = new XMLHttpRequest();
		req.open('NOTIFY', this.relayItem.context.url, false);
		req.setRequestHeader('Authorization', 'Bearer '+this.accessToken);
		req.setRequestHeader('Content-type', 'application/json');
		req.send(JSON.stringify({ src: this.assignedDomain, dst: dst, msg: { type: 'disconnect' } }));
	}
};

Relay.prototype.makeDomain = function(user, app, sid) {
	return helpers.makePeerDomain(user, this.providerDomain, app, sid);
};

// :DEBUG: helper to deal with webrtc issues
if (typeof window !== 'undefined') {
	window.logWebRTC = function(v) {
		if (typeof v == 'undefined') v = true;
		var k;
		for (k in httpl.getRelays()) {
			httpl.getRelay(k).config.log = v;
		}
		for (k in httpl.getServers()) {
			var s = httpl.getServer(k);
			if (s.context && s.context instanceof RTCBridgeServer) {
				s.context.config.log = v;
			}
		}
	};
}
},{"../util":9,"./agent.js":10,"./helpers.js":14,"./httpl.js":16,"./rtc-bridge-server.js":20}],18:[function(require,module,exports){
var util = require('../util');
var promise = require('../promises.js').promise;
var contentTypes = require('./content-types.js');
var httpHeaders = require('./http-headers.js');

// Request
// =======
// EXPORTED
// Interface for sending requests
function Request(options) {
	util.EventEmitter.call(this);

	if (!options) options = {};
	if (typeof options == 'string')
		options = { url: options };

	// Pull any header-like keys into the headers object
	var headers = options.headers || {};
	extractUppercaseKeys(options, headers); // Foo_Bar or Foo-Bar

	this.method = options.method ? options.method.toUpperCase() : 'GET';
	this.url = options.url || null;
	this.path = options.path || null;
	this.query = options.query || {};
	this.headers = lowercaseKeys(headers);
	if (!this.headers.host && options.host) {
		this.headers.host = options.host;
	}

	// Guess the content-type if a full body is included in the message
	if (options.body && !this.headers['content-type']) {
		this.headers['content-type'] = (typeof options.body == 'string') ? 'text/plain' : 'application/json';
	}
	// Make sure we have an accept header
	if (!this.headers['accept']) {
		this.headers['accept'] = '*/*';
	}

	// non-enumerables (dont include in request messages)
	Object.defineProperty(this, 'parsedHeaders', {
		value: {},
		configurable: true,
		enumerable: false,
		writable: true
	});
	Object.defineProperty(this, 'body', {
		value: options.body || '',
		configurable: true,
		enumerable: false,
		writable: true
	});
	Object.defineProperty(this, 'stream', {
		value: options.stream || false,
		configurable: true,
		enumerable: false,
		writable: true
	});
	Object.defineProperty(this, 'binary', {
		value: options.binary || false,
		configurable: true,
		enumerable: false,
		writable: true
	});
	Object.defineProperty(this, 'isConnOpen', {
		value: true,
		configurable: true,
		enumerable: false,
		writable: true
	});

	// request buffering
	Object.defineProperty(this, 'body_', {
		value: promise(),
		configurable: true,
		enumerable: false,
		writable: false
	});
	(function buffer(self) {
		self.on('data', function(data) { self.body += data; });
		self.on('end', function() {
			if (self.headers['content-type'])
				self.body = contentTypes.deserialize(self.headers['content-type'], self.body);
			self.body_.fulfill(self.body);
		});
	})(this);
}
module.exports = Request;
Request.prototype = Object.create(util.EventEmitter.prototype);

Request.prototype.header = function(k, v) {
	if (typeof v != 'undefined')
		return this.setHeader(k, v);
	return this.getHeader(k);
};
Request.prototype.setHeader    = function(k, v) { this.headers[k.toLowerCase()] = v; };
Request.prototype.getHeader    = function(k) { return this.headers[k.toLowerCase()]; };
Request.prototype.removeHeader = function(k) { delete this.headers[k.toLowerCase()]; };

// causes the request/response to abort after the given milliseconds
Request.prototype.setTimeout = function(ms) {
	var self = this;
	if (this.__timeoutId) return;
	Object.defineProperty(this, '__timeoutId', {
		value: setTimeout(function() {
			if (self.isConnOpen) { self.close(); }
			delete self.__timeoutId;
		}, ms),
		configurable: true,
		enumerable: false,
		writable: true
	});
};

// EXPORTED
// calls any registered header serialization functions
// - enables apps to use objects during their operation, but remain conformant with specs during transfer
Request.prototype.serializeHeaders = function() {
	for (var k in this.headers) {
		this.headers[k] = httpHeaders.serialize(k, this.headers[k]);
	}
};

// EXPORTED
// calls any registered header deserialization functions
// - enables apps to use objects during their operation, but remain conformant with specs during transfer
Request.prototype.deserializeHeaders = function() {
	for (var k in this.headers) {
		var parsedHeader = httpHeaders.deserialize(k, this.headers[k]);
		if (parsedHeader && typeof parsedHeader != 'string') {
			this.parsedHeaders[k] = parsedHeader;
		}
	}
};

// sends data over the stream
// - emits the 'data' event
Request.prototype.write = function(data) {
	if (!this.isConnOpen)
		return this;
	if (typeof data != 'string')
		data = contentTypes.serialize(this.headers['content-type'], data);
	this.emit('data', data);
	return this;
};

// ends the request stream
// - `data`: optional mixed, to write before ending
// - emits 'end' and 'close' events
Request.prototype.end = function(data) {
	if (!this.isConnOpen)
		return this;
	if (typeof data != 'undefined')
		this.write(data);
	this.emit('end');
	// this.close();
	// ^ do not close - the response should close
	return this;
};

// closes the stream, aborting if not yet finished
// - emits 'close' event
Request.prototype.close = function() {
	if (!this.isConnOpen)
		return this;
	this.isConnOpen = false;
	this.emit('close');

	// :TODO: when events are suspended, this can cause problems
	//        maybe put these "removes" in a 'close' listener?
	// this.removeAllListeners('data');
	// this.removeAllListeners('end');
	// this.removeAllListeners('close');
	return this;
};

// internal helper
function lowercaseKeys(obj) {
	var obj2 = {};
	for (var k in obj) {
		if (obj.hasOwnProperty(k))
			obj2[k.toLowerCase()] = obj[k];
	}
	return obj2;
}

// internal helper - has side-effects
var underscoreRegEx = /_/g;
function extractUppercaseKeys(/*mutable*/ org, /*mutable*/ dst) {
	for (var k in org) {
		var kc = k.charAt(0);
		if (org.hasOwnProperty(k) && kc === kc.toUpperCase()) {
			var k2 = k.replace(underscoreRegEx, '-');
			dst[k2] = org[k];
			delete org[k];
		}
	}
}
},{"../promises.js":4,"../util":9,"./content-types.js":12,"./http-headers.js":15}],19:[function(require,module,exports){
var util = require('../util');
var promise = require('../promises.js').promise;
var helpers = require('./helpers.js');
var contentTypes = require('./content-types.js');
var httpHeaders = require('./http-headers.js');

// Response
// ========
// EXPORTED
// Interface for receiving responses
// - usually created internally and returned by `dispatch`
function Response() {
	var self = this;
	util.EventEmitter.call(this);

	this.status = 0;
	this.reason = null;
	this.headers = {};
	this.body = '';

	// non-enumerables (dont include in response messages)
	Object.defineProperty(this, 'parsedHeaders', {
		value: {},
		configurable: true,
		enumerable: false,
		writable: true
	});
	Object.defineProperty(this, 'isConnOpen', {
		value: true,
		configurable: true,
		enumerable: false,
		writable: true
	});
	Object.defineProperty(this, 'latency', {
		value: undefined,
		configurable: true,
		enumerable: false,
		writable: true
	});

	// response buffering
	Object.defineProperty(this, 'body_', {
		value: promise(),
		configurable: true,
		enumerable: false,
		writable: false
	});
	this.on('data', function(data) {
		if (data instanceof ArrayBuffer)
			self.body = data; // browsers buffer binary responses, so dont try to stream
		else
			self.body += data;
	});
	this.on('end', function() {
		if (self.headers['content-type'])
			self.body = contentTypes.deserialize(self.headers['content-type'], self.body);
		self.body_.fulfill(self.body);
	});
}
module.exports = Response;
Response.prototype = Object.create(util.EventEmitter.prototype);

Response.prototype.header = function(k, v) {
	if (typeof v != 'undefined')
		return this.setHeader(k, v);
	return this.getHeader(k);
};
Response.prototype.setHeader    = function(k, v) { this.headers[k.toLowerCase()] = v; };
Response.prototype.getHeader    = function(k) { return this.headers[k.toLowerCase()]; };
Response.prototype.removeHeader = function(k) { delete this.headers[k.toLowerCase()]; };

// EXPORTED
// calls any registered header serialization functions
// - enables apps to use objects during their operation, but remain conformant with specs during transfer
Response.prototype.serializeHeaders = function() {
	for (var k in this.headers) {
		this.headers[k] = httpHeaders.serialize(k, this.headers[k]);
	}
};

// EXPORTED
// calls any registered header deserialization functions
// - enables apps to use objects during their operation, but remain conformant with specs during transfer
Response.prototype.deserializeHeaders = function() {
	for (var k in this.headers) {
		var parsedHeader = httpHeaders.deserialize(k, this.headers[k]);
		if (parsedHeader && typeof parsedHeader != 'string') {
			this.parsedHeaders[k] = parsedHeader;
		}
	}
};

// EXPORTED
// Makes sure response header links are absolute and extracts additional attributes
//var isUrlAbsoluteRE = /(:\/\/)|(^[-A-z0-9]*\.[-A-z0-9]*)/; // has :// or starts with ___.___
Response.prototype.processHeaders = function(request) {
	var self = this;


	// Update the link headers
	if (self.parsedHeaders.link) {
		self.parsedHeaders.link.forEach(function(link) {
			// Convert relative paths to absolute uris
			if (!helpers.isAbsUri(link.href))
				link.href = helpers.joinRelPath(request.urld, link.href);

			// Extract host data
			var host_domain = helpers.parseUri(link.href).authority;
			Object.defineProperty(link, 'host_domain', { enumerable: false, configurable: true, writable: true, value: host_domain });
			var peerd = helpers.parsePeerDomain(link.host_domain);
			if (peerd) {
				Object.defineProperty(link, 'host_user', { enumerable: false, configurable: true, writable: true, value: peerd.user });
				Object.defineProperty(link, 'host_relay', { enumerable: false, configurable: true, writable: true, value: peerd.relay });
				Object.defineProperty(link, 'host_app', { enumerable: false, configurable: true, writable: true, value: peerd.app });
				Object.defineProperty(link, 'host_sid', { enumerable: false, configurable: true, writable: true, value: peerd.sid });
			} else {
				delete link.host_user;
				delete link.host_relay;
				delete link.host_app;
				delete link.host_sid;
			}
		});
	}
};

// writes the header to the response
// - emits the 'headers' event
Response.prototype.writeHead = function(status, reason, headers) {
	if (!this.isConnOpen)
		return this;
	this.status = status;
	this.reason = reason;
	if (headers) {
		for (var k in headers) {
			if (headers.hasOwnProperty(k))
				this.setHeader(k, headers[k]);
		}
	}
	this.serializeHeaders();

	this.emit('headers', this);
	return this;
};

// sends data over the stream
// - emits the 'data' event
Response.prototype.write = function(data) {
	if (!this.isConnOpen)
		return this;
	if (typeof data != 'string') {
		data = contentTypes.serialize(this.headers['content-type'], data);
	}
	this.emit('data', data);
	return this;
};

// ends the response stream
// - `data`: optional mixed, to write before ending
// - emits 'end' and 'close' events
Response.prototype.end = function(data) {
	if (!this.isConnOpen)
		return this;
	if (typeof data != 'undefined')
		this.write(data);
	this.emit('end');
	this.close();
	return this;
};

// closes the stream, aborting if not yet finished
// - emits 'close' event
Response.prototype.close = function() {
	if (!this.isConnOpen)
		return this;
	this.isConnOpen = false;
	this.emit('close');

	// :TODO: when events are suspended, this can cause problems
	//        maybe put these "removes" in a 'close' listener?
	// this.removeAllListeners('headers');
	// this.removeAllListeners('data');
	// this.removeAllListeners('end');
	// this.removeAllListeners('close');
	return this;
};
},{"../promises.js":4,"../util":9,"./content-types.js":12,"./helpers.js":14,"./http-headers.js":15}],20:[function(require,module,exports){
var global=typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {};var util = require('../util');
var helpers = require('./helpers.js');
var httpl = require('./httpl.js');
var BridgeServer = require('./bridge-server.js');

var peerConstraints = {
	optional: [/*{RtpDataChannels: true}, */{DtlsSrtpKeyAgreement: true}]
};
var defaultIceServers = { iceServers: [{ url: 'stun:stun.l.google.com:19302' }] };

// Browser compat
var __env = (typeof window != 'undefined') ? window : ((typeof self != 'undefined') ? self : global);
var RTCSessionDescription = __env.mozRTCSessionDescription || __env.RTCSessionDescription;
var RTCPeerConnection = __env.mozRTCPeerConnection || __env.webkitRTCPeerConnection || __env.RTCPeerConnection;
var RTCIceCandidate = __env.mozRTCIceCandidate || __env.RTCIceCandidate;


// RTCBridgeServer
// ===============
// EXPORTED
// server wrapper for WebRTC connections
// - `config.peer`: required string, who we are connecting to (a valid peer domain)
// - `config.relay`: required Relay
// - `config.initiate`: optional bool, if true will initiate the connection processes
// - `config.loopback`: optional bool, is this the local host? If true, will connect to self
// - `config.retryTimeout`: optional number, time (in ms) before a connection is aborted and retried (defaults to 15000)
// - `config.retries`: optional number, number of times to retry before giving up (defaults to 3)
// - `config.log`: optional bool, enables logging of all message traffic and webrtc connection processes
function RTCBridgeServer(config) {
	// Config
	var self = this;
	if (!config) config = {};
	if (!config.peer) throw new Error("`config.peer` is required");
	if (!config.relay) throw new Error("`config.relay` is required");
	if (typeof config.retryTimeout == 'undefined') config.retryTimeout = 15000;
	if (typeof config.retries == 'undefined') config.retries = 3;
	BridgeServer.call(this, config);
	util.mixinEventEmitter(this);

	// Parse config.peer
	var peerd = helpers.parsePeerDomain(config.peer);
	if (!peerd) {
		throw new Error("Invalid peer URL: "+config.peer);
	}
	this.peerInfo = peerd;

	// Internal state
	this.isConnecting     = true;
	this.isOfferExchanged = false;
	this.isConnected      = false;
	this.isTerminated     = false;
	this.candidateQueue   = []; // cant add candidates till we get the offer
	this.offerNonce       = 0; // a random number used to decide who takes the lead if both nodes send an offer
	this.retriesLeft      = config.retries;
	this.rtcPeerConn      = null;
	this.rtcDataChannel   = null;

	// Create the peer connection
	this.createPeerConn();

	if (this.config.loopback) {
		// Setup to serve self
		this.isOfferExchanged = true;
		onHttplChannelOpen.call(this);
	} else {
		if (this.config.initiate) {
			// Initiate event will be picked up by the peer
			// If they want to connect, they'll send an answer back
			this.sendOffer();
		}
	}
}
RTCBridgeServer.prototype = Object.create(BridgeServer.prototype);
module.exports = RTCBridgeServer;

RTCBridgeServer.prototype.getPeerInfo = function() { return this.peerInfo; };
RTCBridgeServer.prototype.terminate = function(opts) {
	BridgeServer.prototype.terminate.call(this);
	this.isTerminated = true;
	if (this.isConnecting || this.isConnected) {
		if (!(opts && opts.noSignal)) {
			this.signal({ type: 'disconnect' });
		}
		this.isConnecting = false;
		this.isConnected = false;
		this.destroyPeerConn();
		this.emit('disconnected', Object.create(this.peerInfo), this);
	}
};

// Returns true if the channel is ready for activity
// - returns boolean
RTCBridgeServer.prototype.isChannelActive = function() {
	return true;// this.isConnected; - we send messages over the relay before connection
};

// Sends a single message across the channel
// - `msg`: required string
RTCBridgeServer.prototype.channelSendMsg = function(msg) {
	if (this.config.loopback) {
		this.onChannelMessage(msg);
	} else if (!this.isConnected) {
		this.signal({
			type: 'httpl',
			data: msg
		});
	} else {
		try { // :DEBUG: as soon as WebRTC stabilizes some more, let's ditch this
			this.rtcDataChannel.send(msg);

			// Can now rely on sctp ordering
			if (this.isReorderingMessages) {
				this.useMessageReordering(false);
			}
		} catch (e) {
			this.debugLog('NETWORK ERROR, BOUNCING', e);
			// Probably a NetworkError - one known cause, one party gets a dataChannel and the other doesnt
			this.signal({
				type: 'httpl',
				data: msg
			});
		}
	}
};

// Remote request handler
RTCBridgeServer.prototype.handleRemoteRequest = function(request, response) {
	var server = this.config.relay.getServer();
	if (server && typeof server == 'function') {
		server.call(this, request, response, this);
	} else if (server && server.handleRemoteRequest) {
		server.handleRemoteRequest(request, response, this);
	} else {
		response.writeHead(501, 'not implemented');
		response.end();
	}
};

// HTTPL channel event handlers
// -

function onHttplChannelMessage(msg) {
	this.debugLog('HTTPL CHANNEL MSG', msg);

	// Pass on to method in parent prototype
	this.onChannelMessage(msg.data);
}

function onHttplChannelOpen(e) {
	console.log('Successfully established WebRTC session with', this.config.peer);
	this.debugLog('HTTPL CHANNEL OPEN', e);

	// Update state
	this.isConnecting = false;
	this.isConnected = true;

	// Can now rely on sctp ordering :WRONG: it appears "open" get fired assymetrically
	// this.useMessageReordering(false);

	// Emit event
	this.emit('connected', Object.create(this.peerInfo), this);
}

function onHttplChannelClose(e) {
	console.log('Closed WebRTC session with', this.config.peer);
	this.debugLog('HTTPL CHANNEL CLOSE', e);
	this.terminate({ noSignal: true });
}

function onHttplChannelError(e) {
	this.debugLog('HTTPL CHANNEL ERR', e);
	this.emit('error', Object.create(this.peerInfo, { error: { value: e } }), this);
}

// Signal relay behaviors
// -

RTCBridgeServer.prototype.onSignal = function(msg) {
	var self = this;

	switch (msg.type) {
		case 'disconnect':
			// Peer's dead, shut it down
			this.terminate({ noSignal: true });
			break;

		case 'candidate':
			this.debugLog('GOT CANDIDATE', msg.candidate);
			// Received address info from the peer
			if (!this.isOfferExchanged) {
				// Store for when offer/answer exchange has finished
				this.candidateQueue.push(msg.candidate);
			} else {
				// Pass into the peer connection
				this.rtcPeerConn.addIceCandidate(new RTCIceCandidate({ candidate: msg.candidate }));
			}
			break;

		case 'offer':
			// Received a session offer from the peer
			this.debugLog('GOT OFFER', msg);
			if (this.isConnected) {
				this.debugLog('RECEIVED AN OFFER WHEN BELIEVED TO BE CONNECTED, DROPPING');
				return;
			}

			// Abandon ye' hope if no rtc support
			if (typeof RTCSessionDescription == 'undefined') {
				return;
			}

			// Emit event
			if (!this.isOfferExchanged) {
				this.emit('connecting', Object.create(this.peerInfo), this);
			}

			// Guard against an offer race conditions
			if (this.config.initiate) {
				// Leader conflict - compare nonces
				this.debugLog('LEADER CONFLICT DETECTED, COMPARING NONCES', 'MINE=', this.offerNonce, 'THEIRS=', msg.nonce);
				if (this.offerNonce < msg.nonce) {
					// Reset into follower role
					this.debugLog('RESETTING INTO FOLLOWER ROLE');
					this.config.initiate = false;
					this.resetPeerConn();
				}
			}

			// Watch for reset offers from the leader
			if (!this.config.initiate && this.isOfferExchanged) {
				if (this.retriesLeft > 0) {
					this.retriesLeft--;
					this.debugLog('RECEIVED A NEW OFFER, RESETTING AND RETRYING. RETRIES LEFT:', this.retriesLeft);
					this.resetPeerConn();
				} else {
					this.debugLog('RECEIVED A NEW OFFER, NO RETRIES LEFT. GIVING UP.');
					this.terminate();
					return;
				}
			}

			// Update the peer connection
			var desc = new RTCSessionDescription({ type: 'offer', sdp: msg.sdp });
			this.rtcPeerConn.setRemoteDescription(desc);

			// Burn the ICE candidate queue
			handleOfferExchanged.call(this);

			// Send an answer
			this.rtcPeerConn.createAnswer(
				function(desc) {
					self.debugLog('CREATED ANSWER', desc);

					// Store the SDP
					desc.sdp = increaseSDP_MTU(desc.sdp);
					self.rtcPeerConn.setLocalDescription(desc);

					// Send answer msg
					self.signal({ type: 'answer', sdp: desc.sdp });
				},
				function(error) {
					self.emit('error', Object.create(this.peerInfo, { error: { value: error } }), self);
				}
			);
			break;

		case 'answer':
			// Received session confirmation from the peer
			this.debugLog('GOT ANSWER', msg);

			// Update the peer connection
			this.rtcPeerConn.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: msg.sdp }));

			// Burn the ICE candidate queue
			handleOfferExchanged.call(this);
			break;

		case 'httpl':
			// Received HTTPL traffic from the peer
			this.debugLog('GOT HTTPL RELAY', msg);

			// Handle
			this.onChannelMessage(msg.data);
			break;

		default:
			console.warn('RTCBridgeServer - Unrecognized signal message from relay', msg);
	}
};

// Helper to send a message to peers on the relay
RTCBridgeServer.prototype.signal = function(msg) {
	// Send the message through our relay
	var self = this;
	var response_ = this.config.relay.signal(this.config.peer, msg);
	response_.fail(function(res) {
		if (res.status == 404 && !self.isTerminated) {
			// Peer not online, shut down for now. We can try to reconnect later
			for (var k in self.incomingStreams) {
				try {
					self.incomingStreams[k].writeHead(404, 'not found').end();
				} catch (e) {
					console.error('That weird peer 404 error', e, self.incomingStreams[k]);
				}
			}
			self.terminate({ noSignal: true });
			httpl.removeServer(self.config.domain);
		}
	});
	return response_;
};

// Helper sets up the peer connection
RTCBridgeServer.prototype.createPeerConn = function() {
	if (!this.rtcPeerConn && typeof RTCPeerConnection != 'undefined') {
		var servers = this.config.iceServers || defaultIceServers;
		this.rtcPeerConn = new RTCPeerConnection(servers, peerConstraints);
		this.rtcPeerConn.onicecandidate             = onIceCandidate.bind(this);
		this.rtcPeerConn.oniceconnectionstatechange = onIceConnectionStateChange.bind(this);
		this.rtcPeerConn.onsignalingstatechange     = onSignalingStateChange.bind(this);
		this.rtcPeerConn.ondatachannel              = onDataChannel.bind(this);

		// Reorder messages until the WebRTC session is established
		this.useMessageReordering(true);
	}
};

// Helper tears down the peer conn
RTCBridgeServer.prototype.destroyPeerConn = function(suppressEvents) {
	if (this.rtcDataChannel) {
		this.rtcDataChannel.close();
		if (suppressEvents) {
			this.rtcDataChannel.onopen    = null;
			this.rtcDataChannel.onclose   = null;
			this.rtcDataChannel.onerror   = null;
			this.rtcDataChannel.onmessage = null;
		}
		this.rtcDataChannel = null;
	}
	if (this.rtcPeerConn) {
		this.rtcPeerConn.close();
		if (suppressEvents) {
			this.rtcPeerConn.onicecandidate             = null;
			this.rtcPeerConn.oniceconnectionstatechange = null;
			this.rtcPeerConn.onsignalingstatechange     = null;
			this.rtcPeerConn.ondatachannel              = null;
		}
		this.rtcPeerConn = null;
	}
};

// Helper restarts the connection process
RTCBridgeServer.prototype.resetPeerConn = function(suppressEvents) {
	this.destroyPeerConn(true);
	this.createPeerConn();
	this.candidateQueue.length = 0;
	this.isOfferExchanged = false;
};

// Helper initiates a timeout clock for the connection process
function initConnectTimeout() {
	var self = this;
	setTimeout(function() {
		// Leader role only
		if (self.config.initiate && self.isConnected === false) {
			if (self.retriesLeft > 0) {
				self.retriesLeft--;
				self.debugLog('CONNECTION TIMED OUT, RESTARTING. TRIES LEFT:', self.retriesLeft);
				// Reset
				self.resetPeerConn();
				self.sendOffer();
			} else {
				// Give up
				console.log('Failed to establish WebRTC session with', self.config.peer, ' - Will continue bouncing traffic through the relay');
				self.debugLog('CONNECTION TIMED OUT, GIVING UP');
				self.resetPeerConn();
				// ^ resets but doesn't terminate - can try again with sendOffer()
			}
		}
	}, this.config.retryTimeout);
}

// Helper initiates a session with peers on the relay
RTCBridgeServer.prototype.sendOffer = function() {
	var self = this;
	if (typeof RTCPeerConnection == 'undefined') {
		return;
	}

	try {
		// Create the HTTPL data channel
		this.rtcDataChannel = this.rtcPeerConn.createDataChannel('httpl', { reliable: true });
		this.rtcDataChannel.onopen     = onHttplChannelOpen.bind(this);
		this.rtcDataChannel.onclose    = onHttplChannelClose.bind(this);
		this.rtcDataChannel.onerror    = onHttplChannelError.bind(this);
		this.rtcDataChannel.onmessage  = onHttplChannelMessage.bind(this);
	} catch (e) {
		// Probably a NotSupportedError - give up and let bouncing handle it
		return;
	}

	// Start the clock
	initConnectTimeout.call(this);

	// Generate offer
	this.rtcPeerConn.createOffer(
		function(desc) {
			self.debugLog('CREATED OFFER', desc);

			// Store the SDP
			desc.sdp = increaseSDP_MTU(desc.sdp);
			self.rtcPeerConn.setLocalDescription(desc);

			// Generate an offer nonce
			self.offerNonce = Math.round(Math.random() * 10000000);

			// Send offer msg
			self.signal({ type: 'offer', sdp: desc.sdp, nonce: self.offerNonce });
		},
		function(error) {
			self.emit('error', Object.create(this.peerInfo, { error: { value: error } }), self);
		}
	);
	// Emit 'connecting' on next tick
	// (next tick to make sure objects creating us get a chance to wire up the event)
	util.nextTick(function() {
		self.emit('connecting', Object.create(self.peerInfo), self);
	});
};

// Helper called whenever we have a remote session description
// (candidates cant be added before then, so they're queued in case they come first)
function handleOfferExchanged() {
	var self = this;
	this.isOfferExchanged = true;
	this.candidateQueue.forEach(function(candidate) {
		self.rtcPeerConn.addIceCandidate(new RTCIceCandidate({ candidate: candidate }));
	});
	this.candidateQueue.length = 0;
}

// Called by the RTCPeerConnection when we get a possible connection path
function onIceCandidate(e) {
	if (e && !!e.candidate) {
		this.debugLog('FOUND ICE CANDIDATE', e.candidate);
		// send connection info to peers on the relay
		this.signal({ type: 'candidate', candidate: e.candidate.candidate });
	}
}

// Called by the RTCPeerConnection on connectivity events
function onIceConnectionStateChange(e) {
	if (!!e.target && e.target.iceConnectionState === 'disconnected') {
		this.debugLog('ICE CONNECTION STATE CHANGE: DISCONNECTED', e);
		this.terminate({ noSignal: true });
	}
}

// Called by the RTCPeerConnection on connectivity events
function onSignalingStateChange(e) {
	if(e.target && e.target.signalingState == "closed"){
		this.debugLog('SIGNALING STATE CHANGE: DISCONNECTED', e);
		this.terminate({ noSignal: true });
	}
}

// Called by the RTCPeerConnection when a datachannel is created (receiving party only)
function onDataChannel(e) {
	this.debugLog('DATA CHANNEL PROVIDED', e);
	this.rtcDataChannel = e.channel;
	this.rtcDataChannel.onopen     = onHttplChannelOpen.bind(this);
	this.rtcDataChannel.onclose    = onHttplChannelClose.bind(this);
	this.rtcDataChannel.onerror    = onHttplChannelError.bind(this);
	this.rtcDataChannel.onmessage  = onHttplChannelMessage.bind(this);
}

// Increases the bandwidth allocated to our connection
// Thanks to michellebu (https://github.com/michellebu/reliable)
var higherBandwidthSDPRE = /b\=AS\:([\d]+)/i;
function increaseSDP_MTU(sdp) {
	return sdp;
	// return sdp.replace(higherBandwidthSDPRE, 'b=AS:102400'); // 100 Mbps
}
},{"../util":9,"./bridge-server.js":11,"./helpers.js":14,"./httpl.js":16}],21:[function(require,module,exports){
var util = require('../util');
var helpers = require('./helpers.js');
var contentTypes = require('./content-types.js');

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
schemes.register(['http', 'https'], function(request, response) {
	// parse URL
	var urld = helpers.parseUri(request.url);

	// if a query was given in the options, mix it into the urld
	if (request.query) {
		var q = contentTypes.serialize('application/x-www-form-urlencoded', request.query);
		if (q) {
			if (urld.query) {
				urld.query    += '&' + q;
				urld.relative += '&' + q;
			} else {
				urld.query     =  q;
				urld.relative += '?' + q;
			}
		}
	}

	// assemble the final url
	var url = ((urld.protocol) ? (urld.protocol + '://') : '//') + urld.authority + urld.relative;

	// create the request
	var xhrRequest = new XMLHttpRequest();
	xhrRequest.open(request.method, url, true);
	if (request.binary) {
		xhrRequest.responseType = 'arraybuffer';
		if (request.stream)
			console.warn('Got HTTP/S request with binary=true and stream=true - sorry, not supported, binary responses must be buffered (its a browser thing)', request);
	}

	// set headers
	request.serializeHeaders();
	for (var k in request.headers) {
		if (request.headers[k] !== null && request.headers.hasOwnProperty(k))
			xhrRequest.setRequestHeader(k, request.headers[k]);
	}

	// buffer the body, send on end
	var body = '';
	request.on('data', function(data) { body += data; });
	request.on('end', function() { xhrRequest.send(body); });

	// abort on request close
	request.on('close', function() {
		if (xhrRequest.readyState !== XMLHttpRequest.DONE) {
			xhrRequest.aborted = true;
			xhrRequest.abort();
		}
	});

	// register response handlers
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
						headers[kv[0].toLowerCase()] = kv.slice(1).join(': ');
					});
				} else {
					// a bug in firefox causes getAllResponseHeaders to return an empty string on CORS
					// (not ideal, but) iterate the likely headers
					var extractHeader = function(k) {
						var v = xhrRequest.getResponseHeader(k);
						if (v)
							headers[k.toLowerCase()] = v.toLowerCase();
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

			response.writeHead(xhrRequest.status, xhrRequest.statusText, headers);

			// start polling for updates
			if (!response.binary) {
				// ^ browsers buffer binary responses, so dont bother streaming
				streamPoller = setInterval(function() {
					// new data?
					var len = xhrRequest.response.length;
					if (len > lenOnLastPoll) {
						var chunk = xhrRequest.response.slice(lenOnLastPoll);
						lenOnLastPoll = len;
						response.write(chunk);
					}
				}, 50);
			}
		}
		if (xhrRequest.readyState === XMLHttpRequest.DONE) {
			if (streamPoller)
				clearInterval(streamPoller);
			if (response.status !== 0 && xhrRequest.status === 0 && !xhrRequest.aborted) {
				// a sudden switch to 0 (after getting a non-0) probably means a timeout
				console.debug('XHR looks like it timed out; treating it as a premature close'); // just in case things get weird
				response.close();
			} else {
				if (xhrRequest.response)
					response.write(xhrRequest.response.slice(lenOnLastPoll));
				response.end();
			}
		}
	};
});


// Data
// ====
schemes.register('data', function(request, response) {
	var firstColonIndex = request.url.indexOf(':');
	var firstCommaIndex = request.url.indexOf(',');

	// parse parameters
	var param;
	var params = request.url.slice(firstColonIndex+1, firstCommaIndex).split(';');
	var contentType = params.shift();
	var isBase64 = false;
	while ((param = params.shift())) {
		if (param == 'base64')
			isBase64 = true;
	}

	// parse data
	var data = request.url.slice(firstCommaIndex+1);
	if (!data) data = '';
	if (isBase64) data = atob(data);
	else data = decodeURIComponent(data);

	// respond (async)
	util.nextTick(function() {
		response.writeHead(200, 'ok', {'content-type': contentType});
		response.end(data);
	});
});
},{"../util":9,"./content-types.js":12,"./helpers.js":14}],22:[function(require,module,exports){
// Server
// ======
// EXPORTED
// core type for all servers
// - should be used as a prototype
function Server(config) {
	this.config = { domain: null, log: false };
	if (config) {
		for (var k in config)
			this.config[k] = config[k];
	}
}
module.exports = Server;

Server.prototype.getDomain = function() { return this.config.domain; };
Server.prototype.getUrl = function() { return 'httpl://' + this.config.domain; };

Server.prototype.debugLog = function() {
	if (!this.config.log) return;
	var args = [this.config.domain].concat([].slice.call(arguments));
	console.debug.apply(console, args);
};

// Local request handler
// - should be overridden
Server.prototype.handleLocalRequest = function(request, response) {
	console.warn('handleLocalRequest not defined', this);
	response.writeHead(501, 'server not implemented');
	response.end();
};

// Called before server destruction
// - may be overridden
// - executes syncronously; does not wait for cleanup to finish
Server.prototype.terminate = function() {
};

},{}],23:[function(require,module,exports){
// Events
// ======
var util = require('../util');
var dispatch = require('./dispatch.js').dispatch;
var Request = require('./request.js');
var Response = require('./response.js');
var contentTypes = require('./content-types.js');

// subscribe()
// ===========
// EXPORTED
// Establishes a connection and begins an event stream
// - sends a GET request with 'text/event-stream' as the Accept header
// - `request`: request object, formed as in `dispatch()`
// - returns a `EventStream` object
function subscribe(request) {
	if (typeof request == 'string')
		request = { url: request };
	request.stream = true; // stream the response
	if (!request.method) request.method = 'SUBSCRIBE';
	if (!request.headers) request.headers = { accept : 'text/event-stream' };
	if (!request.headers.accept) request.headers.accept = 'text/event-stream';

	var response_ = dispatch(request);
	return new EventStream(response_.request, response_);
}


// EventStream
// ===========
// EXPORTED
// wraps a response to emit the events
function EventStream(request, response_) {
	util.EventEmitter.call(this);
	this.request = request;
	this.response = null;
	this.response_ = null;
	this.lastEventId = -1;
	this.isConnOpen = true;

	this.connect(response_);
}
EventStream.prototype = Object.create(util.EventEmitter.prototype);
EventStream.prototype.getUrl = function() { return this.request.url; };
EventStream.prototype.connect = function(response_) {
	var self = this;
	var buffer = '', eventDelimIndex;
	this.response_ = response_;
	response_.then(
		function(response) {
			self.isConnOpen = true;
			self.response = response;
			response.on('data', function(payload) {
				// Add any data we've buffered from past events
				payload = buffer + payload;
				// Step through each event, as its been given
				while ((eventDelimIndex = payload.indexOf('\r\n\r\n')) !== -1) {
					var event = payload.slice(0, eventDelimIndex);
					emitEvent.call(self, event);
					payload = payload.slice(eventDelimIndex+4);
				}
				// Hold onto any lefovers
				buffer = payload;
				// Clear the response' buffer
				response.body = '';
			});
			response.on('end', function() { self.close(); });
			response.on('close', function() { if (self.isConnOpen) { self.reconnect(); } });
			// ^ a close event should be predicated by an end(), giving us time to close ourselves
			//   if we get a close from the other side without an end message, we assume connection fault
			return response;
		},
		function(response) {
			self.response = response;
			emitError.call(self, { event: 'error', data: response });
			self.close();
			throw response;
		}
	);
};
EventStream.prototype.reconnect = function() {
	// Shut down anything old
	if (this.isConnOpen) {
		this.isConnOpen = false;
		this.request.close();
	}

	// Hold off if the app is tearing down (Firefox will succeed in the request and then hold onto the stream)
	if (util.isAppClosing) {
		return;
	}

	// Re-establish the connection
	this.request = new Request(this.request);
	if (!this.request.headers) this.request.headers = {};
	if (this.lastEventId) this.request.headers['last-event-id'] = this.lastEventId;
	this.connect(dispatch(this.request));
	this.request.end();
};
EventStream.prototype.close = function() {
	if (this.isConnOpen) {
		this.isConnOpen = false;
		this.request.close();
		this.emit('close');
	}
};
function emitError(e) {
	this.emit('message', e);
	this.emit('error', e);
}
function emitEvent(e) {
	e = contentTypes.deserialize('text/event-stream', e);
	var id = parseInt(e.id, 10);
	if (typeof id != 'undefined' && id > this.lastEventId)
		this.lastEventId = id;
	this.emit('message', e);
	this.emit(e.event, e);
}


// EventHost
// =========
// EXPORTED
// manages response streams for a server to emit events to
function EventHost() {
	this.streams = [];
}

// listener management
EventHost.prototype.addStream = function(responseStream) {
	responseStream.broadcastStreamId = this.streams.length;
	this.streams.push(responseStream);
	var self = this;
	responseStream.on('close', function() {
		self.endStream(responseStream);
	});
	return responseStream.broadcastStreamId;
};
EventHost.prototype.endStream = function(responseStream) {
	if (typeof responseStream == 'number') {
		responseStream = this.streams[responseStream];
	}
	delete this.streams[responseStream.broadcastStreamId];
	responseStream.end();
};
EventHost.prototype.endAllStreams = function() {
	this.streams.forEach(function(rS) { rS.end(); });
	this.streams.length = 0;
};

// Sends an event to all streams
// - `opts.exclude`: optional number|Response|[number]|[Response], streams not to send to
EventHost.prototype.emit = function(eventName, data, opts) {
	if (!opts) opts = {};
	if (opts.exclude) {
		if (!Array.isArray(opts.exclude)) {
			opts.exclude = [opts.exclude];
		}
		// Convert to ids
		opts.exclude = opts.exclude.map(function(v) {
			if (v instanceof Response) {
				return v.broadcastStreamId;
			}
			return v;
		}, this);
	}
	this.streams.forEach(function(rS, i) {
		if (opts.exclude && opts.exclude.indexOf(i) !== -1) {
			return;
		}
		this.emitTo(rS, eventName, data);
	}, this);
};

// sends an event to the given response stream
EventHost.prototype.emitTo = function(responseStream, eventName, data) {
	if (typeof responseStream == 'number') {
		responseStream = this.streams[responseStream];
	}
	responseStream.write({ event: eventName, data: data });

	// Clear the response's buffer, as the data is handled on emit
	responseStream.body = '';
};

module.exports = {
	subscribe: subscribe,
	EventStream: EventStream,
	EventHost: EventHost
};
},{"../util":9,"./content-types.js":12,"./dispatch.js":13,"./request.js":18,"./response.js":19}],24:[function(require,module,exports){
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
},{}],25:[function(require,module,exports){
var promise = require('../promises.js').promise;
var helpers = require('./helpers.js');
var BridgeServer = require('./bridge-server.js');

// WorkerBridgeServer
// ==================
// EXPORTED
// wrapper for servers run within workers
// - `config.src`: optional URL, required unless `config.domain` is given
// - `config.domain`: optional hostname, required with a source-path unless `config.src` is given
// - `config.serverFn`: optional function to replace handleRemoteRequest
// - `config.shared`: boolean, should the workerserver be shared?
// - `config.namespace`: optional string, what should the shared worker be named?
//   - defaults to `config.src` if undefined
// - `config.temp`: optional bool, instructs the worker to self-destruct after its finished responding to its requests
// - `config.log`: optional bool, enables logging of all message traffic
function WorkerBridgeServer(config) {
	var self = this;
	if (!config || (!config.src && !config.domain))
		throw new Error("WorkerBridgeServer requires config with `src` or `domain` attribute.");
	BridgeServer.call(this, config);
	this.isActive = false; // when true, ready for activity
	this.hasHostPrivileges = true; // do we have full control over the worker?
	// ^ set to false by the ready message of a shared worker (if we're not the first page to connect)
	if (config.serverFn) {
		this.configServerFn = config.serverFn;
		delete this.config.serverFn; // clear out the function from config, so we dont get an error when we send config to the worker
	}

	var src_ = promise();
	if (config.src) {
		if (config.src.indexOf('blob:') === 0) {
			src_.fulfill(config.src);
		} else {
			loadScript(config.src);
		}
	}
	else if (config.domain) {
		// No src? Try fetching from sourcepath
		var domaind = helpers.parseUri(config.domain);
		if (domaind.srcPath) {
			// :WARN: in FF, Workers created by Blobs have been known to fail with a CSP script directive set
			// https://bugzilla.mozilla.org/show_bug.cgi?id=964276
			loadScript(helpers.joinUri(domaind.host, domaind.srcPath));
		} else {
			src_.reject(null);
			this.terminate(404, 'Worker Not Properly Constructed');
			throw "Worker incorrectly constructed without src or a domain with a source-path";
		}
	}

	function loadScript(url) {
		var urld = local.parseUri(url);
		if (!urld.authority || urld.authority == '.' || urld.authority.indexOf('.') === -1) {
			var dir = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'));
			var dirurl = window.location.protocol + '//' + window.location.hostname + dir;
			url = helpers.joinRelPath(dirurl, url);
			urld = local.parseUri(url);
		}
		var full_url = (!urld.protocol) ? 'https://'+url : url;
		local.GET(url)
			.fail(function(res) {
				if (!urld.protocol && (res.status === 0 || res.status == 404)) {
					// Not found? Try again without ssl
					full_url = 'http://'+url;
					return local.GET(full_url);
				}
				throw res;
			})
			.then(function(res) {
				// Setup the bootstrap source to import scripts relative to the origin
				var bootstrap_src = require('../config.js').workerBootstrapScript;
				var hosturld = local.parseUri(full_url);
				var hostroot = hosturld.protocol + '://' + hosturld.authority;
				bootstrap_src = bootstrap_src.replace(/\{\{HOST\}\}/g, hostroot);
				bootstrap_src = bootstrap_src.replace(/\{\{HOST_DIR_PATH\}\}/g, hosturld.directory.slice(0,-1));
				bootstrap_src = bootstrap_src.replace(/\{\{HOST_DIR_URL\}\}/g, hostroot + hosturld.directory.slice(0,-1));

				// Create worker
				var script_blob = new Blob([bootstrap_src+'(function(){'+res.body+'; if (main) { self.main = main; }})();'], { type: "text/javascript" });
				src_.fulfill(window.URL.createObjectURL(script_blob));
			})
			.fail(function(res) {
				src_.reject(null);
				self.terminate(404, 'Worker Not Found');
			});
	}

	src_.then(function(src) {
		self.config.src = src;

		// Prep config
		if (!self.config.domain) { // assign a temporary label for logging if no domain is given yet
			self.config.domain = '<'+self.config.src.slice(0,40)+'>';
		}
		self.config.environmentHost = window.location.host; // :TODO: needed? I think workers can access this directly

		// Initialize the worker
		if (self.config.shared) {
			self.worker = new SharedWorker(src, config.namespace);
			self.worker.port.start();
		} else {
			self.worker = new Worker(src);
		}

		// Setup the incoming message handler
		self.getPort().addEventListener('message', function(event) {
			var message = event.data;
			if (!message)
				return console.error('Invalid message from worker: Payload missing', self, event);
			if (self.config.log) { self.debugLog('received from worker', message); }

			// Handle messages with an `op` field as worker-control packets rather than HTTPL messages
			switch (message.op) {
				case 'ready':
					// Worker can now accept commands
					self.onWorkerReady(message.body);
					break;
				case 'log':
					self.onWorkerLog(message.body);
					break;
				case 'terminate':
					self.terminate();
					break;
				default:
					// If no 'op' field is given, treat it as an HTTPL request and pass onto our BridgeServer parent method
					self.onChannelMessage(message);
					break;
			}
		});
	});
}
WorkerBridgeServer.prototype = Object.create(BridgeServer.prototype);
module.exports = WorkerBridgeServer;

// Returns the worker's messaging interface
// - varies between shared and normal workers
WorkerBridgeServer.prototype.getPort = function() {
	return this.worker.port ? this.worker.port : this.worker;
};

WorkerBridgeServer.prototype.terminate = function(status, reason) {
	BridgeServer.prototype.terminate.call(this, status, reason);
	if (this.worker) this.worker.terminate();
	if (this.config.src.indexOf('blob:') === 0) {
		window.URL.revokeObjectURL(this.config.src);
	}
	this.worker = null;
	this.isActive = false;
};

// Returns true if the channel is ready for activity
// - returns boolean
WorkerBridgeServer.prototype.isChannelActive = function() {
	return this.isActive;
};

// Sends a single message across the channel
// - `msg`: required string
WorkerBridgeServer.prototype.channelSendMsg = function(msg) {
	if (this.config.log) { this.debugLog('sending to worker', msg); }
	this.getPort().postMessage(msg);
};

// Remote request handler
// - should be overridden
WorkerBridgeServer.prototype.handleRemoteRequest = function(request, response) {
	var httpl = require('./httpl.js');
	if (this.configServerFn) {
		this.configServerFn.call(this, request, response, this);
	} else if (httpl.getServer('worker-bridge')) {
		var server = httpl.getServer('worker-bridge');
		server.fn.call(server.context, request, response, this);
	} else {
		response.writeHead(501, 'server not implemented');
		response.end();
	}
};

// Local request handler
WorkerBridgeServer.prototype.handleLocalRequest = function(request, response) {
	BridgeServer.prototype.handleLocalRequest.call(this, request, response);
	if (this.config.temp) {
		response.on('close', closeTempIfDone.bind(this));
	}
};

function closeTempIfDone() {
	if (!this.isActive) return;

	// Are we waiting on any streams from the worker?
	if (Object.keys(this.incomingStreams).length !== 0) {
		var Response = require('./response.js');
		// See if any of those streams are responses
		for (var sid in this.incomingStreams) {
			if (this.incomingStreams[sid] instanceof Response && this.incomingStreams[sid].isConnOpen) {
				// not done, worker still responding
				return;
			}
		}
	}

	// Done, terminate and remove worker
	console.log('Closing temporary worker', this.config.domain);
	this.terminate();
	require('./httpl').removeServer(this.config.domain);
}

// Starts normal functioning
// - called when the local.js signals that it has finished loading
WorkerBridgeServer.prototype.onWorkerReady = function(message) {
	this.hasHostPrivileges = message.hostPrivileges;
	if (this.hasHostPrivileges) {
		// Send config
		this.channelSendMsg({ op: 'configure', body: this.config });
	}
	this.isActive = true;
	this.flushBufferedMessages();
};

// Logs message data from the worker
WorkerBridgeServer.prototype.onWorkerLog = function(message) {
	if (!message)
		return;
	if (!Array.isArray(message))
		return console.error('Received invalid "log" operation: Payload must be an array', message);

	var type = message.shift();
	var args = ['['+this.config.domain+']'].concat(message);
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
},{"../config.js":1,"../promises.js":4,"./bridge-server.js":11,"./helpers.js":14,"./httpl":16,"./httpl.js":16,"./response.js":19}],26:[function(require,module,exports){
module.exports = {};
},{}],27:[function(require,module,exports){
if (typeof self != 'undefined' && typeof self.window == 'undefined') {

	var util = require('../util');
	var schemes = require('../web/schemes.js');
	var httpl = require('../web/httpl.js');
	var WorkerConfig = require('./config.js');
	var PageBridgeServer = require('./page-bridge-server.js');

	// Setup
	// =====
	module.exports = { config: WorkerConfig };
	util.mixinEventEmitter(module.exports);

	// EXPORTED
	// console.* replacements
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
		var hostPage = module.exports.hostPage;
		try { hostPage.channelSendMsg({ op: 'log', body: [type].concat(args) }); }
		catch (e) {
			// this is usually caused by trying to log information that cant be serialized
			hostPage.channelSendMsg({ op: 'log', body: [type].concat(args.map(JSONifyMessage)) });
		}
	}

	// INTERNAL
	// helper to try to get a failed log message through
	function JSONifyMessage(data) {
		if (Array.isArray(data))
			return data.map(JSONifyMessage);
		if (data && typeof data == 'object')
			return JSON.stringify(data);
		return data;
	}

	// INTERNAL
	// set the http/s schemes to report disabled
	schemes.register(['http', 'https'], function(req, res) {
		res.writeHead(0, 'XHR Not Allowed in Workers for Security Reasons').end();
	});

	// EXPORTED
	// btoa shim
	// - from https://github.com/lydonchandra/base64encoder
	//   (thanks to Lydon Chandra)
	if (!self.btoa) {
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

	module.exports.setServer = function(fn) {
		self.main = fn;
		httpl.addServer('self', fn);
	};

	module.exports.pages = [];
	function addConnection(port) {
		// Create new page server
		var isHost = (!module.exports.hostPage); // First to add = host page
		var page = new PageBridgeServer(module.exports.pages.length, port, isHost);

		// Track new connection
		if (isHost) {
			module.exports.hostPage = page;
			httpl.addServer('host.page', page);
		}
		module.exports.pages.push(page);
		httpl.addServer(page.id+'.page', page);

		// Let the document know we're active
		if (port.start) {
			port.start();
		}
		page.channelSendMsg({ op: 'ready', body: { hostPrivileges: isHost } });

		// Fire event
		module.exports.emit('connect', page);
	}

	// Setup for future connections (shared worker)
	addEventListener('connect', function(e) {
		addConnection(e.ports[0]);
	});
	// Create connection to host page (regular worker)
	if (self.postMessage) {
		addConnection(self);
	}
}
},{"../util":9,"../web/httpl.js":16,"../web/schemes.js":21,"./config.js":26,"./page-bridge-server.js":28}],28:[function(require,module,exports){
var util = require('../util');
var workerConfig = require('./config.js');
var BridgeServer = require('../web/bridge-server.js');

// PageServer
// ==========
// EXPORTED
// wraps the comm interface to a page for messaging
// - `id`: required number, should be the index of the connection in the list
// - `port`: required object, either `self` (for non-shared workers) or a port from `onconnect`
// - `isHost`: boolean, should connection get host privileges?
function PageServer(id, port, isHost) {
	BridgeServer.call(this);
	this.id = id;
	this.port = port;
	this.isHostPage = isHost;

	// Setup the incoming message handler
	this.port.addEventListener('message', (function(event) {
		var message = event.data;
		if (!message)
			return console.error('Invalid message from page: Payload missing', event);

		// Handle messages with an `op` field as worker-control packets rather than HTTPL messages
		switch (message.op) {
			case 'configure':
				this.onPageConfigure(message.body);
				break;
			case 'terminate':
				this.terminate();
				break;
			default:
				// If no recognized 'op' field is given, treat it as an HTTPL request and pass onto our BridgeServer parent method
				this.onChannelMessage(message);
				break;
		}
	}).bind(this));
}
PageServer.prototype = Object.create(BridgeServer.prototype);
module.exports = PageServer;

// Returns true if the channel is ready for activity
// - returns boolean
PageServer.prototype.isChannelActive = function() {
	return true;
};

// Sends a single message across the channel
// - `msg`: required string
PageServer.prototype.channelSendMsg = function(msg) {
	this.port.postMessage(msg);
};

// Remote request handler
PageServer.prototype.handleRemoteRequest = function(request, response) {
	var server = self.main;
	if (server && typeof server == 'function') {
		server.call(this, request, response, this);
	} else if (server && server.handleRemoteRequest) {
		server.handleRemoteRequest(request, response, this);
	} else {
		response.writeHead(501, 'not implemented');
		response.end();
	}
};

// Stores configuration sent by the page
PageServer.prototype.onPageConfigure = function(message) {
	if (!this.isHostPage) {
		console.log('rejected "configure" from non-host connection');
		return;
	}
	var serverFn = workerConfig.serverFn;
	util.mixin.call(workerConfig, message);
	workerConfig.serverFn = serverFn;
};
},{"../util":9,"../web/bridge-server.js":11,"./config.js":26}]},{},[3])
;