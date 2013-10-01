// promises
// ========
// pfraze 2013

(function () {
	var exports = this;
	if (typeof window !== "undefined") {
		if (typeof window.local == 'undefined')
			window.local = {};
		exports = window.local;
	} else if (typeof self !== "undefined") {
		if (typeof self.local == 'undefined')
			self.local = {};
		exports = self.local;
	} else if (typeof module !== "undefined") {
		exports = module.exports;
	}

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
				if (local.logAllExceptions || e instanceof Error) {
					if (console.error)
						console.error(e, e.stack);
					else console.log("Promise exception thrown", e, e.stack);
				}
				targetPromise.reject(e);
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
			setTimeout(function() {
				if (self.isFulfilled())
					execCallback(self, p, succeedFn);
				else
					execCallback(self, p, failFn);
			}, 0);
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

	exports.Promise = Promise;
	exports.promise = promise;
	exports.promise.bundle = bundle;
	exports.promise.all = all;
	exports.promise.any = any;
})();

if (typeof define !== "undefined") {
	define([], function() {
		return Promise;
	});
}// Local Utilities
// ===============
// pfraze 2013

if (typeof this.local == 'undefined')
	this.local = {};
if (typeof this.local.util == 'undefined')
	this.local.util = {};

(function() {// EventEmitter
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
}

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

local.util.EventEmitter = EventEmitter;

// Adds event-emitter behaviors to the given object
// - should be used on instantiated objects, not prototypes
local.util.mixinEventEmitter = function(obj) {
	EventEmitter.call(obj);
	for (var k in EventEmitter.prototype) {
		obj[k] = EventEmitter.prototype[k];
	}
};// Helpers
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

// EXPORTED
// extracts request parameters from an anchor tag
extractRequest.fromAnchor = function(node) {

	// get the anchor
	node = findParentNode.byTag(node, 'A');
	if (!node || !node.attributes.href || node.attributes.href.value.charAt(0) == '#') { return null; }

	// pull out params
	var request = {
		// method  : 'get',
		url     : node.attributes.href.value,
		target  : node.getAttribute('target'),
		headers : { accept:node.getAttribute('type') }
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

	var requests = { submitter:{}, form:{} };
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
	var promise = local.promise();
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
	return local.promise.bundle(fileReads).then(function(files) {
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

local.util.findParentNode = findParentNode;
local.util.trackFormSubmitter = trackFormSubmitter;
local.util.dispatchRequestEvent = dispatchRequestEvent;
local.util.extractRequest = extractRequest;
local.util.extractRequestPayload = extractRequestPayload;
local.util.finishPayloadFileReads = finishPayloadFileReads;// http://jsperf.com/cloning-an-object/2
local.util.deepClone = function(obj) {
	return JSON.parse(JSON.stringify(obj));
};})();// Local HTTP
// ==========
// pfraze 2013

if (typeof this.local == 'undefined')
	this.local = {};

(function() {
// Local status codes
// ==================
// used to specify client operation states

// link query failed to match
local.LINK_NOT_FOUND = 1;// Helpers
// =======

// EXPORTED
// takes parsed a link header and a query object, produces an array of matching links
// - `links`: [object]/object, either the parsed array of links or the request/response object
local.queryLinks = function queryLinks(links, query) {
	if (!links) return [];
	if (links.parsedHeaders) links = links.parsedHeaders.link; // actually a request or response object
	if (!Array.isArray(links)) return [];
	return links.filter(function(link) { return local.queryLink(link, query); });
};

// EXPORTED
// takes parsed link and a query object, produces boolean `isMatch`
// - `query`: object, keys are attributes to test, values are values to test against (strings)
//            eg { rel: 'foo bar', id: 'x' }
// - Query rules
//   - if a query attribute is present on the link, but does not match, returns false
//   - if a query attribute is not present on the link, and is not present in the href as a URI Template token, returns false
//   - otherwise, returns true
//   - query values preceded by an exclamation-point (!) will invert (logical NOT)
//   - rel: can take multiple values, space-separated, which are ANDed logically
//   - rel: will ignore the preceding scheme and trailing slash on URI values
//   - rel: items preceded by an exclamation-point (!) will invert (logical NOT)
local.queryLink = function queryLink(link, query) {
	for (var attr in query) {
		if (attr == 'rel') {
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
				if (RegExp('\\{[^\\}]*'+attr+'[^\\{]*\\}','i').test(link.href) === false)
					return false;
			}
			else {
				if (query[attr].indexOf('!') === 0) { // negation
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
};

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
// returns an array of preferred media types ordered by priority from a list of available media types
// - `accept`: string/object, given accept header or request object
// - `provided`: optional [string], allowed media types
local.preferredTypes = function preferredTypes(accept, provided) {
	if (typeof accept == 'object') {
		accept = accept.headers.accept;
	}
	accept = local.httpHeaders.deserialize('accept', accept || '');
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
};

// EXPORTED
// returns the top preferred media type from a list of available media types
// - `accept`: string/object, given accept header or request object
// - `provided`: optional [string], allowed media types
local.preferredType = function preferredType(accept, provided) {
	return local.preferredTypes(accept, provided)[0];
};
// </https://github.com/federomero/negotiator>

// EXPORTED
// correctly joins together all url segments given in the arguments
// eg joinUrl('/foo/', '/bar', '/baz/') -> '/foo/bar/baz/'
local.joinUrl = function joinUrl() {
	var parts = Array.prototype.map.call(arguments, function(arg, i) {
		arg = ''+arg;
		var lo = 0, hi = arg.length;
		if (arg == '/') return '';
		if (i !== 0 && arg.charAt(0) === '/') { lo += 1; }
		if (arg.charAt(hi - 1) === '/') { hi -= 1; }
		return arg.substring(lo, hi);
	});
	return parts.join('/');
};

// EXPORTED
// tests to see if a URL is absolute
// - "absolute" means that the URL can reach something without additional context
// - eg http://foo.com, //foo.com, httpl://bar.app, rel:http://foo.com, rel:foo.com
var isAbsUriRE = /^((http(s|l)?:)?\/\/)|((nav:)?\|\|)/;
local.isAbsUri = function(url) {
	if (isAbsUriRE.test(url))
		return true;
	var urld = local.parseUri(url);
	return !!local.getLocal(urld.authority) || !!local.parsePeerDomain(urld.authority);
};

// EXPORTED
// tests to see if a URL is using the nav scheme
var isNavSchemeUriRE = /^(nav:)?\|?\|/i;
local.isNavSchemeUri = function(v) {
	return isNavSchemeUriRE.test(v);
};


// EXPORTED
// takes a context url and a relative path and forms a new valid url
// eg joinRelPath('http://grimwire.com/foo/bar', '../fuz/bar') -> 'http://grimwire.com/foo/fuz/bar'
local.joinRelPath = function(urld, relpath) {
	if (typeof urld == 'string') {
		urld = local.parseUri(urld);
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
	return local.joinUrl(protocol + urld.authority, hostpathParts.join('/'));
};

// EXPORTED
// parseUri 1.2.2, (c) Steven Levithan <stevenlevithan.com>, MIT License
local.parseUri = function parseUri(str) {
	if (typeof str === 'object') {
		if (str.url) { str = str.url; }
		else if (str.host || str.path) { str = local.joinUrl(req.host, req.path); }
	}

	// handle data-uris specially - performance characteristics are much different
	if (str.slice(0,5) == 'data:') {
		return { protocol: 'data', source: str };
	}

	var	o   = local.parseUri.options,
		m   = o.parser[o.strictMode ? "strict" : "loose"].exec(str),
		uri = {},
		i   = 14;

	while (i--) uri[o.key[i]] = m[i] || "";

	uri[o.q.name] = {};
	uri[o.key[12]].replace(o.q.parser, function ($0, $1, $2) {
		if ($1) uri[o.q.name][$1] = $2;
	});

	return uri;
};

local.parseUri.options = {
	strictMode: false,
	key: ["source","protocol","authority","userInfo","user","password","host","port","relative","path","directory","file","query","anchor"],
	q:   {
		name:   "queryKey",
		parser: /(?:^|&)([^&=]*)=?([^&]*)/g
	},
	parser: {
		strict: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,
		loose:  /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/
	}
};

// EXPORTED
// Converts a 'nav:' URI into an array of http/s/l URIs and link query objects
local.parseNavUri = function(str) {
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
				query.rel = kv[0].replace(/\+/, ' ');
				if (kv[1])
					query.id = kv[1];
			} else
				query[kv[0]] = decodeURIComponent(kv[1]).replace(/\+/, ' ');
		}
		parts[i] = query;
	}

	// Drop first entry if empty (a relative nav uri)
	if (!parts[0])
		parts.shift();

	return parts;
};

// EXPORTED
// breaks a peer domain into its constituent parts
// - returns { user:, relay:, provider:, app:, stream: }
//   (relay == provider -- they are synonmyms)
var peerDomainRE = /^(.+)@(.+)!(.+):([\d]+)$/i;
local.parsePeerDomain = function parsePeerDomain(domain) {
	var match = peerDomainRE.exec(domain);
	if (match) {
		return {
			user: match[1],
			relay: match[2],
			provider: match[2],
			app: match[3],
			stream: match[4]
		};
	}
	return null;
};

// EXPORTED
// constructs a peer domain from its constituent parts
// - returns string
local.makePeerDomain = function makePeerDomain(user, relay, app, stream) {
	return user+'@'+relay+'!'+app+':'+(stream||'0');
};


// sends the given response back verbatim
// - if `writeHead` has been previously called, it will not change
// - params:
//   - `target`: the response to populate
//   - `source`: the response to pull data from
//   - `headersCb`: (optional) takes `(headers)` from source and responds updated headers for target
//   - `bodyCb`: (optional) takes `(body)` from source and responds updated body for target
local.pipe = function(target, source, headersCB, bodyCb) {
	headersCB = headersCB || function(v) { return v; };
	bodyCb = bodyCb || function(v) { return v; };
	return local.promise(source)
		.succeed(function(source) {
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
		})
		.fail(function(source) {
			var ctype = source.headers['content-type'] || 'text/plain';
			var body = (ctype && source.body) ? source.body : '';
			target.writeHead(502, 'bad gateway', {'content-type':ctype});
			target.end(body);
			throw source;
		});
};// contentTypes
// ============
// EXPORTED
// provides serializers and deserializers for MIME types
var contentTypes = {
	serialize   : contentTypes__serialize,
	deserialize : contentTypes__deserialize,
	register    : contentTypes__register
};
var contentTypes__registry = {};
local.contentTypes = contentTypes;

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
local.contentTypes.register('application/json',
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
local.contentTypes.register('application/x-www-form-urlencoded',
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
local.contentTypes.register('text/event-stream',
	function (obj) {
		if (typeof obj.data != 'undefined')
			return "event: "+obj.event+"\r\ndata: "+JSON.stringify(obj.data)+"\r\n\r\n";
		return "event: "+obj.event+"\r\n\r\n";
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
		try { m.data = JSON.parse(m.data); }
		catch(e) {}
		return m;
	}
);
function splitEventstreamKV(kv) {
	var i = kv.indexOf(':');
	return [kv.slice(0, i).trim(), kv.slice(i+1).trim()];
}// headers
// =======
// EXPORTED
// provides serializers and deserializers for HTTP headers
var httpHeaders = {
	serialize   : httpheaders__serialize,
	deserialize : httpheaders__deserialize,
	register    : httpheaders__register
};
var httpheaders__registry = {};
local.httpHeaders = httpHeaders;

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
	return fn(obj);
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
		console.warn('Failed to deserialize content', header, str);
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

var linkHeaderRE1 = /<(.*?)>(?:;[\s]*([^,]*))/g;
var linkHeaderRE2 = /([\-a-z0-9\.]+)=?(?:(?:"([^"]+)")|([^;\s]+))?/g;
local.httpHeaders.register('link',
	function (obj) {
		var links = [];
		obj.forEach(function(link) {
			var linkParts = ['<'+link.href+'>'];
			for (var attr in link) {
				if (attr == 'href') {
					continue;
				}
				if (typeof link[attr] == 'boolean') {
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

local.httpHeaders.register('accept',
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
	function (str) {
		return str.split(',')
			.map(function(e) { return parseMediaType(e.trim()); })
			.filter(function(e) { return e && e.q > 0; });
	}
);
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
}// Request
// =======
// EXPORTED
// Interface for sending requests
function Request(options) {
	local.util.EventEmitter.call(this);

	if (!options) options = {};
	if (typeof options == 'string')
		options = { url: options };

	this.method = options.method ? options.method.toUpperCase() : 'GET';
	this.url = options.url || null;
	this.path = options.path || null;
	this.query = options.query || {};
	this.headers = options.headers || {};
	this.body = '';

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
		value: '',
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
		value: local.promise(),
		configurable: true,
		enumerable: false,
		writable: false
	});
	(function buffer(self) {
		self.on('data', function(data) { self.body += data; });
		self.on('end', function() {
			if (self.headers['content-type'])
				self.body = local.contentTypes.deserialize(self.headers['content-type'], self.body);
			self.body_.fulfill(self.body);
		});
	})(this);
}
local.Request = Request;
Request.prototype = Object.create(local.util.EventEmitter.prototype);

Request.prototype.setHeader    = function(k, v) { this.headers[k] = v; };
Request.prototype.getHeader    = function(k) { return this.headers[k]; };
Request.prototype.removeHeader = function(k) { delete this.headers[k]; };
Request.prototype.finishStream = function() { return this.body_; };

// causes the request/response to abort after the given milliseconds
Request.prototype.setTimeout = function(ms) {
	var self = this;
	setTimeout(function() {
		if (self.isConnOpen) self.close();
	}, ms);
};

// EXPORTED
// calls any registered header serialization functions
// - enables apps to use objects during their operation, but remain conformant with specs during transfer
Request.prototype.serializeHeaders = function() {
	for (var k in this.headers) {
		this.headers[k] = local.httpHeaders.serialize(k, this.headers[k]);
	}
};

// EXPORTED
// calls any registered header deserialization functions
// - enables apps to use objects during their operation, but remain conformant with specs during transfer
Request.prototype.deserializeHeaders = function() {
	for (var k in this.headers) {
		var parsedHeader = local.httpHeaders.deserialize(k, this.headers[k]);
		if (parsedHeader && typeof parsedHeader != 'string') {
			this.parsedHeaders[k] = parsedHeader;
		}
	}
};

// sends data over the stream
// - emits the 'data' event
Request.prototype.write = function(data) {
	if (!this.isConnOpen)
		return;
	if (typeof data != 'string')
		data = local.contentTypes.serialize(this.headers['content-type'], data);
	this.emit('data', data);
};

// ends the request stream
// - `data`: optional mixed, to write before ending
// - emits 'end' and 'close' events
Request.prototype.end = function(data) {
	if (!this.isConnOpen)
		return;
	if (typeof data != 'undefined')
		this.write(data);
	this.emit('end');
	// this.close();
	// ^ do not close - the response should close
};

// closes the stream, aborting if not yet finished
// - emits 'close' event
Request.prototype.close = function() {
	if (!this.isConnOpen)
		return;
	this.isConnOpen = false;
	this.emit('close');

	// :TODO: when events are suspended, this can cause problems
	//        maybe put these "removes" in a 'close' listener?
	// this.removeAllListeners('data');
	// this.removeAllListeners('end');
	// this.removeAllListeners('close');
};// Response
// ========
// EXPORTED
// Interface for receiving responses
// - usually created internally and returned by `dispatch`
function Response() {
	local.util.EventEmitter.call(this);

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
		value: local.promise(),
		configurable: true,
		enumerable: false,
		writable: false
	});
	(function buffer(self) {
		self.on('data', function(data) {
			if (data instanceof ArrayBuffer)
				self.body = data; // browsers buffer binary responses, so dont try to stream
			else
				self.body += data;
		});
		self.on('end', function() {
			if (self.headers['content-type'])
				self.body = local.contentTypes.deserialize(self.headers['content-type'], self.body);
			self.body_.fulfill(self.body);
		});
	})(this);
}
local.Response = Response;
Response.prototype = Object.create(local.util.EventEmitter.prototype);

Response.prototype.setHeader    = function(k, v) { this.headers[k] = v; };
Response.prototype.getHeader    = function(k) { return this.headers[k]; };
Response.prototype.removeHeader = function(k) { delete this.headers[k]; };

// EXPORTED
// calls any registered header serialization functions
// - enables apps to use objects during their operation, but remain conformant with specs during transfer
Response.prototype.serializeHeaders = function() {
	for (var k in this.headers) {
		this.headers[k] = local.httpHeaders.serialize(k, this.headers[k]);
	}
};

// EXPORTED
// calls any registered header deserialization functions
// - enables apps to use objects during their operation, but remain conformant with specs during transfer
Response.prototype.deserializeHeaders = function() {
	for (var k in this.headers) {
		var parsedHeader = local.httpHeaders.deserialize(k, this.headers[k]);
		if (parsedHeader && typeof parsedHeader != 'string') {
			this.parsedHeaders[k] = parsedHeader;
		}
	}
};

// writes the header to the response
// - emits the 'headers' event
Response.prototype.writeHead = function(status, reason, headers) {
	if (!this.isConnOpen)
		return;
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
		return;
	if (typeof data != 'string') {
		data = local.contentTypes.serialize(this.headers['content-type'], data);
	}
	this.emit('data', data);
};

// ends the response stream
// - `data`: optional mixed, to write before ending
// - emits 'end' and 'close' events
Response.prototype.end = function(data) {
	if (!this.isConnOpen)
		return;
	if (typeof data != 'undefined')
		this.write(data);
	this.emit('end');
	this.close();
};

// closes the stream, aborting if not yet finished
// - emits 'close' event
Response.prototype.close = function() {
	if (!this.isConnOpen)
		return;
	this.isConnOpen = false;
	this.emit('close');

	// :TODO: when events are suspended, this can cause problems
	//        maybe put these "removes" in a 'close' listener?
	// this.removeAllListeners('headers');
	// this.removeAllListeners('data');
	// this.removeAllListeners('end');
	// this.removeAllListeners('close');
};// Server
// ======
// EXPORTED
// core type for all servers
// - should be used as a prototype
function Server(config) {
	this.config = { domain: null };
	if (config) {
		for (var k in config)
			this.config[k] = config[k];
	}
}
local.Server = Server;

Server.prototype.getDomain = function() { return this.config.domain; };
Server.prototype.getUrl = function() { return 'httpl://' + this.config.domain; };

// Local request handler
// - should be overridden
Server.prototype.handleLocalWebRequest = function(request, response) {
	console.warn('handleLocalWebRequest not defined', this);
	response.writeHead(500, 'server not implemented');
	response.end();
};

// Called before server destruction
// - may be overridden
// - executes syncronously; does not wait for cleanup to finish
Server.prototype.terminate = function() {
};


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
	this.outgoingStreams = {}; // like `incomingStreams`, but for requests & responses that are sending out data
	this.msgBuffer = []; // buffer of messages kept until channel is active
}
BridgeServer.prototype = Object.create(Server.prototype);
local.BridgeServer = BridgeServer;

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
BridgeServer.prototype.handleRemoteWebRequest = function(request, response) {
	console.warn('handleRemoteWebRequest not defined', this);
	response.writeHead(500, 'server not implemented');
	response.end();
};

// Sends messages that were buffered while waiting for the channel to setup
// - should be called by the subclass if there's any period between creation and channel activation
BridgeServer.prototype.flushBufferedMessages = function() {
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
BridgeServer.prototype.handleLocalWebRequest = function(request, response) {
	// Build message
	var sid = this.sidCounter++;
	var msg = {
		sid: sid,
		method: request.method,
		path: request.path,
		query: request.query,
		headers: request.headers
	};

	// Hold onto streams
	this.outgoingStreams[msg.sid] = request;
	this.incomingStreams[-msg.sid] = response; // store response stream in anticipation of the response messages

	// Send over the channel
	this.channelSendMsgWhenReady(JSON.stringify(msg));

	// Wire up request stream events
	var this2 = this;
	request.on('data',  function(data) { this2.channelSendMsgWhenReady(JSON.stringify({ sid: sid, body: data })); });
	request.on('end', function()       { this2.channelSendMsgWhenReady(JSON.stringify({ sid: sid, end: true })); });
	request.on('close', function()     { delete this2.outgoingStreams[msg.sid]; });
};

// Called before server destruction
// - may be overridden
// - executes syncronously; does not wait for cleanup to finish
BridgeServer.prototype.terminate = function() {
	Server.prototype.terminate.call(this);
	for (var sid in this.incomingStreams) {
		this.incomingStreams[sid].end();
	}
	for (sid in this.outgoingStreams) {
		this.outgoingStreams[sid].end();
	}
	this.incomingStreams = this.outgoingStreams = {};
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

	// Get/create stream
	var stream = this.incomingStreams[msg.sid];
	if (!stream) {
		// Incoming requests have a positive sid
		if (msg.sid > 0) {
			// Create request & response
			var request = new local.Request({
				method: msg.method,
				path: msg.path,
				query: msg.query,
				headers: msg.headers
			});
			var response = new local.Response();

			// Wire response into the stream
			var this2 = this;
			var resSid = -(msg.sid);
			response.on('headers', function() {
				this2.channelSendMsg(JSON.stringify({
					sid: resSid,
					status: response.status,
					reason: response.reason,
					headers: response.headers
				}));
			});
			response.on('data',  function(data) {
				this2.channelSendMsg(JSON.stringify({ sid: resSid, body: data }));
			});
			response.on('close', function() {
				this2.channelSendMsg(JSON.stringify({ sid: resSid, end: true }));
				delete this2.outgoingStreams[resSid];
			});

			// Pass on to the request handler
			this.handleRemoteWebRequest(request, response);

			// Hold onto the streams
			stream = this.incomingStreams[msg.sid] = request;
			this.outgoingStreams[resSid] = response;
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

	// {end: true} -> close stream
	if (msg.end) {
		stream.end();
		stream.close();
		delete this.incomingStreams[msg.sid];
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
}// WorkerBridgeServer
// ============
// EXPORTED
// wrapper for servers run within workers
// - `config.src`: required URL
// - `config.serverFn`: optional function to replace handleRemoteWebRequest
// - `config.shared`: boolean, should the workerserver be shared?
// - `config.namespace`: optional string, what should the shared worker be named?
//   - defaults to `config.src` if undefined
// - `config.nullify`: optional [string], a list of objects to nullify when the worker loads
// - `config.bootstrapUrl`: optional string, specifies the URL of the worker bootstrap script
// - `config.log`: optional bool, enables logging of all message traffic
// - `loadCb`: optional function(message)
function WorkerBridgeServer(config, loadCb) {
	if (!config || !config.src)
		throw new Error("WorkerBridgeServer requires config with `src` attribute.");
	local.BridgeServer.call(this, config);
	this.isUserScriptActive = false; // when true, ready for activity
	this.hasHostPrivileges = true; // do we have full control over the worker?
	// ^ set to false by the ready message of a shared worker (if we're not the first page to connect)
	if (config.serverFn) {
		this.configServerFn = config.serverFn;
		delete this.config.serverFn; // clear out the function from config, so we dont get an error when we send config to the worker
	}
	this.loadCb = loadCb;

	// Prep config
	if (!this.config.domain) { // assign a temporary label for logging if no domain is given yet
		this.config.domain = '<'+this.config.src.slice(0,40)+'>';
	}
	this.config.environmentHost = window.location.host; // :TODO: needed? I think workers can access this directly

	// Initialize the worker
	if (this.config.shared) {
		this.worker = new SharedWorker(config.bootstrapUrl || local.workerBootstrapUrl, config.namespace);
		this.worker.port.start();
	} else {
		this.worker = new Worker(config.bootstrapUrl || local.workerBootstrapUrl);
	}

	// Setup the incoming message handler
	this.getPort().addEventListener('message', (function(event) {
		var message = event.data;
		if (!message)
			return console.error('Invalid message from worker: Payload missing', this, event);
		if (this.config.log) { console.debug('WORKER received', message); }

		// Handle messages with an `op` field as worker-control packets rather than HTTPL messages
		switch (message.op) {
			case 'ready':
				// Bootstrap script can now accept commands
				this.onWorkerReady(message.body);
				break;
			case 'loaded':
				// User script has loaded
				this.onWorkerUserScriptLoaded(message.body);
				break;
			case 'log':
				this.onWorkerLog(message.body);
				break;
			case 'terminate':
				this.terminate();
				break;
			default:
				// If no 'op' field is given, treat it as an HTTPL request and pass onto our BridgeServer parent method
				this.onChannelMessage(message);
				break;
		}
	}).bind(this));
}
WorkerBridgeServer.prototype = Object.create(local.BridgeServer.prototype);
local.WorkerBridgeServer = WorkerBridgeServer;

// Returns the worker's messaging interface
// - varies between shared and normal workers
WorkerBridgeServer.prototype.getPort = function() {
	return this.worker.port ? this.worker.port : this.worker;
};

WorkerBridgeServer.prototype.terminate = function() {
	BridgeServer.prototype.terminate.call(this);
	this.worker.terminate();
	this.worker = null;
	this.isUserScriptActive = false;
};

// Instructs the worker to set the given name to null
// - eg worker.nullify('XMLHttpRequest'); // no ajax
WorkerBridgeServer.prototype.nullify = function(name) {
	this.channelSendMsg({ op: 'nullify', body: name });
};

// Instructs the WorkerBridgeServer to import the JS given by the URL
// - eg worker.importScripts('/my/script.js');
// - `urls`: required string|[string]
WorkerBridgeServer.prototype.importScripts = function(urls) {
	this.channelSendMsg({ op: 'importScripts', body: urls });
};

// Returns true if the channel is ready for activity
// - returns boolean
WorkerBridgeServer.prototype.isChannelActive = function() {
	return this.isUserScriptActive;
};

// Sends a single message across the channel
// - `msg`: required string
WorkerBridgeServer.prototype.channelSendMsg = function(msg) {
	if (this.config.log) { console.debug('WORKER sending', msg); }
	this.getPort().postMessage(msg);
};

// Remote request handler
// - should be overridden
BridgeServer.prototype.handleRemoteWebRequest = function(request, response) {
	if (this.configServerFn) {
		this.configServerFn.call(this, request, response, this);
	} else {
		response.writeHead(500, 'server not implemented');
		response.end();
	}
};

// Sends initialization commands
// - called when the bootstrap signals that it has finished loading
WorkerBridgeServer.prototype.onWorkerReady = function(message) {
	this.hasHostPrivileges = message.hostPrivileges;
	if (this.hasHostPrivileges) {
		// Disable undesirable APIs
		if (this.config.nullify) {
			this.config.nullify.forEach(function(api) {
				this.nullify(api);
			}, this);
		}

		// Load user script
		var src = this.config.src;
		if (src.indexOf('data:application/javascript,') === 0)
			src = 'data:application/javacsript;base64,'+btoa(src.slice(28));
		this.channelSendMsg({ op: 'configure', body: this.config });
		this.importScripts(src);
	} else {
		this.onWorkerUserScriptLoaded();
	}
};

// Starts normal operation
// - called when the user script has finished loading
WorkerBridgeServer.prototype.onWorkerUserScriptLoaded = function(message) {
	if (this.loadCb && typeof this.loadCb == 'function') {
		this.loadCb(message);
	}
	if (message && message.error) {
		console.error('Failed to load user script in worker, terminating', message, this);
		this.terminate();
	}
	else {
		this.isUserScriptActive = true;
		this.flushBufferedMessages();
	}
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
};// WebRTC Peer Server
// ==================

(function() {

	var peerConstraints = {
		// optional: [{ RtpDataChannels: true }]
		optional: [{DtlsSrtpKeyAgreement: true}]
	};
	var defaultIceServers = null;//{ iceServers: [{ url: 'stun:stun.l.google.com:19302' }] };

	function randomStreamId() {
		return Math.round(Math.random()*10000);
	}

	// RTCBridgeServer
	// ===============
	// EXPORTED
	// server wrapper for WebRTC connections
	// - currently only supports Chrome
	// - `config.peer`: required string, who we are connecting to (a valid peer domain)
	// - `config.relay`: required PeerWebRelay
	// - `config.initiate`: optional bool, if true will initiate the connection processes
	// - `config.loopback`: optional bool, is this the local host? If true, will connect to self
	function RTCBridgeServer(config) {
		// Config
		var self = this;
		if (!config) config = {};
		if (!config.peer) throw new Error("`config.peer` is required");
		if (!config.relay) throw new Error("`config.relay` is required");
		local.BridgeServer.call(this, config);
		local.util.mixinEventEmitter(this);

		// Parse config.peer
		var peerd = local.parsePeerDomain(config.peer);
		if (!peerd) {
			throw new Error("Invalid peer URL: "+config.peer);
		}
		this.peerInfo = peerd;

		// Internal state
		this.isConnecting = true;
		this.isOfferExchanged = false;
		this.isConnected = false;
		this.candidateQueue = []; // cant add candidates till we get the offer

		// Create the peer connection
		var servers = config.iceServers || defaultIceServers;
		this.rtcPeerConn = new webkitRTCPeerConnection(servers, peerConstraints);
		this.rtcPeerConn.onicecandidate             = onIceCandidate.bind(this);
		this.rtcPeerConn.onicechange                = onIceConnectionStateChange.bind(this);
		this.rtcPeerConn.oniceconnectionstatechange = onIceConnectionStateChange.bind(this);
		this.rtcPeerConn.onsignalingstatechange     = onSignalingStateChange.bind(this);

		// Create the HTTPL data channel
		this.rtcDataChannel = this.rtcPeerConn.createDataChannel('httpl', { reliable: true });
		this.rtcDataChannel.onopen     = onHttplChannelOpen.bind(this);
		this.rtcDataChannel.onclose    = onHttplChannelClose.bind(this);
		this.rtcDataChannel.onerror    = onHttplChannelError.bind(this);
		this.rtcDataChannel.onmessage  = onHttplChannelMessage.bind(this);

		if (this.config.loopback) {
			// Setup to serve self
			this.isOfferExchanged = true;
			onHttplChannelOpen.call(this);
		} else if (this.config.initiate) {
			// Initiate event will be picked up by the peer
			// If they want to connect, they'll send an answer back
			this.sendOffer();
		}
	}
	RTCBridgeServer.prototype = Object.create(local.BridgeServer.prototype);
	local.RTCBridgeServer = RTCBridgeServer;

	RTCBridgeServer.prototype.getPeerInfo = function() {
		return this.peerInfo;
	};

	// :DEBUG:
	RTCBridgeServer.prototype.debugLog = function() {
		var args = [this.config.domain].concat([].slice.call(arguments));
		console.debug.apply(console, args);
	};

	RTCBridgeServer.prototype.terminate = function(opts) {
		BridgeServer.prototype.terminate.call(this);
		if (this.isConnecting || this.isConnected) {
			if (!(opts && opts.noSignal)) {
				this.signal({ type: 'disconnect' });
			}
			this.isConnecting = false;
			this.isConnected = false;
			this.emit('disconnected', { peer: this.peerInfo, domain: this.config.domain, server: this });

			if (this.rtcPeerConn) {
				this.rtcPeerConn.close();
				this.rtcPeerConn = null;
			}
		}
	};

	// Returns true if the channel is ready for activity
	// - returns boolean
	RTCBridgeServer.prototype.isChannelActive = function() {
		return this.isConnected;
	};

	// Sends a single message across the channel
	// - `msg`: required string
	RTCBridgeServer.prototype.channelSendMsg = function(msg) {
		if (this.config.loopback) {
			this.onChannelMessage(msg);
		} else {
			this.rtcDataChannel.send(msg);
		}
	};

	// Remote request handler
	RTCBridgeServer.prototype.handleRemoteWebRequest = function(request, response) {
		if (this.config.serverFn) {
			this.config.serverFn.call(this, request, response, this);
		} else {
			response.writeHead(500, 'not implemented');
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
		this.debugLog('HTTPL CHANNEL OPEN', e);

		// Update state
		this.isConnecting = false;
		this.isConnected = true;
		this.flushBufferedMessages();

		// Emit event
		this.emit('connected', { peer: this.peerInfo, domain: this.config.domain, server: this });
	}

	function onHttplChannelClose(e) {
		this.debugLog('HTTPL CHANNEL CLOSE', e);
		this.terminate({ noSignal: true });
	}

	function onHttplChannelError(e) {
		// :TODO: anything?
		this.debugLog('HTTPL CHANNEL ERR', e);
		this.emit('error', { peer: this.peerInfo, domain: this.config.domain, server: this, err: e });
	}

	// Signal relay behaviors
	// -

	RTCBridgeServer.prototype.onSignal = function(msg) {
		var self = this;

		this.debugLog('SIG', msg);
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
				this.debugLog('GOT OFFER', msg);
				// Received a session offer from the peer
				// Emit event
				this.emit('connecting', { peer: this.peerInfo, domain: this.config.domain, server: this });
				// Update the peer connection
				var desc = new RTCSessionDescription({ type: 'offer', sdp: msg.sdp });
				this.rtcPeerConn.setRemoteDescription(desc);
				// Burn the ICE candidate queue
				handleOfferExchanged.call(self);
				// Send an answer
				this.rtcPeerConn.createAnswer(
					function(desc) {
						self.debugLog('CREATED ANSWER', desc);

						// Store the SDP
						desc.sdp = increaseSDP_MTU(desc.sdp);
						self.rtcPeerConn.setLocalDescription(desc);

						// Send answer msg
						self.signal({ type: 'answer', sdp: desc.sdp });
					}
				);
				break;

			case 'answer':
				this.debugLog('GOT ANSWER', msg);
				// Received session confirmation from the peer
				// Update the peer connection
				this.rtcPeerConn.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: msg.sdp }));
				// Burn the ICE candidate queue
				handleOfferExchanged.call(self);
				break;

			default:
				console.warn('RTCBridgeServer - Unrecognized signal message from relay', msg);
		}
	};

	// Helper to send a message to peers on the relay
	RTCBridgeServer.prototype.signal = function(msg) {
		if (!this.isConnecting || this.isConnected) {
			return;
		}
		// Send the message through our relay
		var self = this;
		this.config.relay.signal(this.config.peer, msg)
			.fail(function(res) {
				if (!self.isConnecting || self.isConnected) {
					return;
				}
				if (res.status == 404) {
					// Peer not online
					for (var k in self.incomingStreams) {
						self.incomingStreams[k].writeHead(404, 'not found').end();
					}
					self.terminate({ noSignal: true });
					local.unregisterLocal(self.config.domain);
				}
			});
	};

	// Helper initiates a session with peers on the relay
	RTCBridgeServer.prototype.sendOffer = function() {
		var self = this;
		// Generate offer
		this.rtcPeerConn.createOffer(
			function(desc) {
				self.debugLog('CREATED OFFER', desc);

				// store the SDP
				desc.sdp = increaseSDP_MTU(desc.sdp);
				self.rtcPeerConn.setLocalDescription(desc);

				// Send offer msg
				self.signal({ type: 'offer', sdp: desc.sdp });
			}
		);
		// Emit 'connecting' on next tick
		// (next tick to make sure objects creating us get a chance to wire up the event)
		setTimeout(function() {
			self.emit('connecting', { peer: self.peerInfo, domain: self.config.domain, server: self });
		}, 0);
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
		if (e && e.candidate) {
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

	// Increases the bandwidth allocated to our connection
	// Thanks to michellebu (https://github.com/michellebu/reliable)
	var higherBandwidthSDPRE = /b\=AS\:([\d]+)/i;
	function increaseSDP_MTU(sdp) {
		return sdp;
		// return sdp.replace(higherBandwidthSDPRE, 'b=AS:102400'); // 100 Mbps
	}


	// PeerWebRelay
	// ============
	// EXPORTED
	// Helper class for managing a peer web relay provider
	// - `config.provider`: optional string, the relay provider
	// - `config.serverFn`: optional function, the function for peerservers' handleRemoteWebRequest
	// - `config.app`: optional string, the app to join as (defaults to window.location.hostname)
	// - `config.stream`: optional number, the stream id (defaults to pseudo-random)
	// - `config.ping`: optional number, sends a ping to self via the relay at the given interval (in ms) to keep the stream alive
	//   - set to false to disable keepalive pings
	//   - defaults to 45000
	function PeerWebRelay(config) {
		if (!config) config = {};
		if (!config.app) config.app = window.location.hostname;
		if (typeof config.stream == 'undefined') config.stream = randomStreamId();
		if (typeof config.ping == 'undefined') { config.ping = 45000; }
		this.config = config;
		local.util.mixinEventEmitter(this);

		// State
		this.myPeerDomain = null;
		this.connectedToRelay = false;
		this.userId = null;
		this.accessToken = null;
		this.bridges = {};
		this.pingInterval = null;

		// Internal helpers
		this.messageFromAuthPopupHandler = null;

		// APIs
		this.p2pwServiceAPI = null;
		this.accessTokenAPI = null;
		this.p2pwUsersAPI = null;
		this.p2pwRelayAPI = null;
		this.relayStream = null;

		// Setup provider config
		if (config.provider) {
			this.setProvider(config.provider);
		}

		// Bind window close behavior
		window.addEventListener('beforeunload', this.onPageClose.bind(this));
	}
	local.PeerWebRelay = PeerWebRelay;

	// Sets the access token and triggers a connect flow
	// - `token`: required String?, the access token (null if denied access)
	// - `token` should follow the form '<userId>:<'
	PeerWebRelay.prototype.setAccessToken = function(token) {
		if (token) {
			// Extract user-id from the access token
			var tokenParts = token.split(':');
			if (tokenParts.length !== 2) {
				throw new Error('Invalid access token');
			}

			// Store
			this.userId = tokenParts[0];
			this.accessToken = token;
			this.p2pwServiceAPI.setRequestDefaults({ headers: { authorization: 'Bearer '+token }});
			this.p2pwUsersAPI.setRequestDefaults({ headers: { authorization: 'Bearer '+token }});

			// Try to validate our access now
			var self = this;
			this.p2pwRelayAPI = this.p2pwServiceAPI.follow({ rel: 'item grimwire.com/-p2pw/relay', id: this.getUserId(), stream: this.getStreamId(), nc: Date.now() });
			this.p2pwRelayAPI.resolve().then(
				function() {
					// Emit an event
					self.emit('accessGranted');
				},
				function(res) {
					// Handle error
					self.onRelayError({ event: 'error', data: res });
				}
			);
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
	PeerWebRelay.prototype.isListening     = function() { return this.connectedToRelay; };
	PeerWebRelay.prototype.getPeerDomain   = function() { return this.myPeerDomain; };
	PeerWebRelay.prototype.getUserId       = function() { return this.userId; };
	PeerWebRelay.prototype.getApp          = function() { return this.config.app; };
	PeerWebRelay.prototype.getStreamId     = function() { return this.config.stream; };
	PeerWebRelay.prototype.setStreamId     = function(stream) { this.config.stream = stream; };
	PeerWebRelay.prototype.getAccessToken  = function() { return this.accessToken; };
	PeerWebRelay.prototype.getServerFn     = function() { return this.config.serverFn; };
	PeerWebRelay.prototype.setServerFn     = function(fn) { this.config.serverFn = fn; };
	PeerWebRelay.prototype.getProvider     = function() { return this.config.provider; };
	PeerWebRelay.prototype.setProvider     = function(providerUrl) {
		// Abort if already connected
		if (this.connectedToRelay) {
			throw new Error("Can not change provider while connected to the relay. Call stopListening() first.");
		}
		// Update config
		this.config.provider = providerUrl;
		this.providerDomain = local.parseUri(providerUrl).host;

		// Create APIs
		this.p2pwServiceAPI = local.navigator(this.config.provider);
		this.accessTokenAPI = this.p2pwServiceAPI.follow({ rel: 'grimwire.com/-access-token', app: this.config.app });
		this.p2pwUsersAPI   = this.p2pwServiceAPI.follow({ rel: 'grimwire.com/-user collection' });
		this.accessTokenAPI.resolve({ nohead: true }); // immediately resolve so requestAccessToken() can use it
	};

	// Gets an access token from the provider & user using a popup
	// - Best if called within a DOM click handler, as that will avoid popup-blocking
	//   (note, however, if the accessTokenAPI hasnt resolved its api yet, there will be an async callback that breaks that)
	// - returns promise(string), fulfills with token on success and rejects with null on failure
	PeerWebRelay.prototype.requestAccessToken = function() {
		var token_ = local.promise();

		// Start listening for messages from the popup
		if (!this.messageFromAuthPopupHandler) {
			this.messageFromAuthPopupHandler = (function(e) {
				console.debug('Message (from ' + e.origin + '): ' + e.data);

				// Make sure this is from our popup
				var originUrld = local.parseUri(e.origin);
				var providerUrld = local.parseUri(this.config.provider);
				if (originUrld.authority !== providerUrld.authority) {
					return;
				}

				// Update our token
				this.setAccessToken(e.data);

				// Stop listening
				window.removeEventListener('message', this.messageFromAuthPopupHandler);

				// If given a null, emit denial event
				if (!e.data) {
					this.emit('accessDenied');
					token_.reject(null);
				} else {
					token_.fulfill(e.data);
				}
			}).bind(this);
		}
		window.addEventListener('message', this.messageFromAuthPopupHandler);

		// Open interface in a popup
		if (this.accessTokenAPI.context.url) {
			// Try to open immediately, to avoid popup blocking
			window.open(this.accessTokenAPI.context.url);
		} else {
			// access token URI hasnt resolved yet, we have to wait for that
			this.accessTokenAPI.resolve({ nohead: true }).always(function(url) {
				window.open(url);
			});
		}

		return token_;
	};

	// Fetches users from p2pw service
	// - opts.online: optional bool, only online users
	// - opts.trusted: optional bool, only users trusted by our session
	PeerWebRelay.prototype.getUsers = function(opts) {
		var api = this.p2pwUsersAPI;
		if (opts) {
			opts.rel = 'self';
			api = api.follow(opts);
		}
		return api.get({ accept: 'application/json' });
	};

	// Subscribes to the event relay and begins handling signals
	// - enables peers to connect
	PeerWebRelay.prototype.startListening = function() {
		var self = this;
		// Make sure we have an access token
		if (!this.getAccessToken()) {
			return;
		}
		// Update "src" object, for use in signal messages
		this.myPeerDomain = this.makeDomain(this.getUserId(), this.config.app, this.config.stream);
		// Connect to the relay stream
		this.p2pwRelayAPI = this.p2pwServiceAPI.follow({ rel: 'item grimwire.com/-p2pw/relay', id: this.getUserId(), stream: this.getStreamId(), nc: Date.now() });
		this.p2pwRelayAPI.subscribe({ method: 'subscribe' })
			.then(
				function(stream) {
					// Update state
					__peer_relay_registry[self.providerDomain] = self;
					self.relayStream = stream;
					self.connectedToRelay = true;
					stream.response_.then(function(response) {
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
							self.signal(self.getPeerDomain(), { type: 'noop' });
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
	PeerWebRelay.prototype.stopListening = function() {
		if (this.connectedToRelay) {
			// Update state
			this.connectedToRelay = false;
			this.relayStream.close();
			this.relayStream = null;
			delete __peer_relay_registry[self.providerDomain];
		}
	};

	// Spawns an RTCBridgeServer and starts the connection process with the given peer
	// - `peerUrl`: required String, the domain/url of the target peer
	// - `config.initiate`: optional Boolean, should the server initiate the connection?
	//   - defaults to true
	//   - should only be false if the connection was already initiated by the opposite end
	PeerWebRelay.prototype.connect = function(peerUrl, config) {
		if (!config) config = {};
		if (typeof config.initiate == 'undefined') config.initiate = true;

		// Make sure we're not already connected
		if (peerUrl in this.bridges) {
			return this.bridges[peerUrl];
		}

		// Parse the url
		var peerUrld = local.parseUri(peerUrl);
		var hostParts = peerUrld.host.split('!');
		var provider = hostParts[0], app = hostParts[1];
		if (!peerUrld.user || !provider || !app || !peerUrld.port) {
			throw new Error("Invalid peer url given to connect(): "+peerUrl);
		}

		// Spawn new server
		var server = new local.RTCBridgeServer({
			peer: peerUrl,
			initiate: config.initiate,
			relay: this,
			serverFn: this.config.serverFn,
			loopback: (peerUrld.authority == this.myPeerDomain)
		});

		// Bind events
		server.on('connecting', this.emit.bind(this, 'connecting'));
		server.on('connected', this.emit.bind(this, 'connected'));
		server.on('disconnected', this.onBridgeDisconnected.bind(this));
		server.on('disconnected', this.emit.bind(this, 'disconnected'));
		server.on('error', this.emit.bind(this, 'error'));

		// Add to hostmap
		this.bridges[peerUrld.authority] = server;
		local.registerLocal(peerUrld.authority, server);

		return server;
	};

	PeerWebRelay.prototype.signal = function(dst, msg) {
		if (!this.p2pwRelayAPI) {
			console.warn('PeerWebRelay - signal() called before relay is connected');
			return;
		}
		return this.p2pwRelayAPI.post({ src: this.myPeerDomain, dst: dst, msg: msg }, null, { retry: true });
	};

	PeerWebRelay.prototype.onSignal = function(e) {
		if (!e.data || !e.data.src || !e.data.msg) {
			console.warn('discarding faulty signal message', err);
		}
		if (e.data.msg.type == 'noop') { return; } // used for heartbeats to keep the stream alive

		// Find bridge that represents this origin
		var domain = e.data.src;
		var bridgeServer = this.bridges[domain];

		// Does bridge exist?
		if (bridgeServer) {
			// Let bridge handle it
			bridgeServer.onSignal(e.data.msg);
		} else {
			if (e.data.msg.type == 'offer') {
				// Create a server to handle the signal
				bridgeServer = this.connect(domain, { initiate: false });
				bridgeServer.onSignal(e.data.msg);
			}
		}
	};

	PeerWebRelay.prototype.onRelayError = function(e) {
		if (e.data && e.data.status == 423) { // locked
			// Update state
			this.relayStream = null;
			this.connectedToRelay = false;

			// Fire event
			this.emit('streamTaken');
		} else if (e.data && (e.data.status == 401 || e.data.status == 403)) { // unauthorized
			// Remove bad access token to stop reconnect attempts
			this.setAccessToken(null);
			// Fire event
			this.emit('accessInvalid');
		} else if (e.data && (e.data.status === 0 || e.data.status == 404 || e.data.status >= 500)) { // connection lost
			// Update state
			this.relayStream = null;
			this.connectedToRelay = false;

			// Attempt to reconnect in 2 seconds
			var self = this;
			setTimeout(function() {
				self.startListening();
				// Note - if this fails, an error will be rethrown and take us back here
			}, 2000);
		} else {
			// Fire event
			this.emit('error', e);
		}
	};

	PeerWebRelay.prototype.onRelayClose = function() {
		// Update state
		var wasConnected = this.connectedToRelay;
		this.connectedToRelay = false;
		if (self.pingInterval) { clearInterval(self.pingInterval); }

		// Fire event
		this.emit('notlistening');

		// Did we expect this close event?
		if (wasConnected) {
			// No, we should reconnect
			this.startListening();
		}
	};

	PeerWebRelay.prototype.onBridgeDisconnected = function(data) {
		// Stop tracking bridges that close
		var bridge = this.bridges[data.domain];
		if (bridge) {
			delete this.bridges[data.domain];
			local.unregisterLocal(data.domain);
		}
	};

	PeerWebRelay.prototype.onPageClose = function() {
		var bridgeDomains = Object.keys(this.bridges);
		if (this.connectedToRelay && bridgeDomains.length !== 0) {
			// Collect connected peer destination info
			var dst = [];
			for (var domain in this.bridges) {
				dst.push(this.bridges[domain].config.peer);
			}

			// Send a synchronous disconnect signal to all connected peers
			var req = new XMLHttpRequest();
			req.open('POST', this.p2pwRelayAPI.context.url, false);
			req.setRequestHeader('Authorization', 'Bearer '+this.accessToken);
			req.setRequestHeader('Content-type', 'application/json');
			req.send(JSON.stringify({ src: this.myPeerDomain, dst: dst, msg: { type: 'disconnect' } }));
		}
	};

	PeerWebRelay.prototype.makeDomain = function(user, app, stream) {
		return local.makePeerDomain(user, this.providerDomain, app, stream);
	};

})();// schemes
// =======
// EXPORTED
// dispatch() handlers, matched to the scheme in the request URIs
var schemes = {
	register: schemes__register,
	unregister: schemes__unregister,
	get: schemes__get
};
var schemes__registry = {};
local.schemes = schemes;

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
local.schemes.register(['http', 'https'], function(request, response) {
	// parse URL
	var urld = local.parseUri(request.url);

	// if a query was given in the options, mix it into the urld
	if (request.query) {
		var q = local.contentTypes.serialize('application/x-www-form-urlencoded', request.query);
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
		if (xhrRequest.readyState !== XMLHttpRequest.DONE)
			xhrRequest.abort();
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
						headers[kv[0].toLowerCase()] = kv[1];
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
			if (response.status !== 0 && xhrRequest.status === 0) {
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


// HTTPL
// =====
var localNotFoundServer = {
	fn: function(request, response) {
		response.writeHead(404, 'server not found');
		response.end();
	},
	context: null
};
var localRelayNotOnlineServer = {
	fn: function(request, response) {
		response.writeHead(407, 'peer relay not authenticated');
		response.end();
	},
	context: null
};
local.schemes.register('httpl', function(request, response) {
	// Find the local server
	var server = local.getLocal(request.urld.authority);
	if (!server) {
		// Check if this is a peerweb URI
		var peerd = local.parsePeerDomain(request.urld.authority);
		if (peerd) {
			if (peerd.relay in __peer_relay_registry) {
				// Try connecting to the peer
				// console.log(peerd,'not found, connecting');
				__peer_relay_registry[peerd.relay].connect(request.urld.authority);
				server = local.getLocal(request.urld.authority);
				// console.log(server);
			} else {
				// We're not connected to the relay
				server = localRelayNotOnlineServer;
			}
		} else
			server = localNotFoundServer;
	}

	// Deserialize the headers
	request.deserializeHeaders();

	// Pull out and standardize the path
	request.path = request.urld.path;
	if (!request.path) request.path = '/'; // no path, give a '/'
	else request.path = request.path.replace(/(.)\/$/, '$1'); // otherwise, never end with a '/'

	// Pull out any query params in the path
	if (request.urld.query) {
		var query = local.contentTypes.deserialize('application/x-www-form-urlencoded', request.urld.query);
		if (!request.query) { request.query = {}; }
		for (var k in query) {
			request.query[k] = query[k];
		}
	}

	// Support warnings
	if (request.binary)
		console.warn('Got HTTPL request with binary=true - sorry, not currently supported', request);

	// Pass on to the server
	server.fn.call(server.context, request, response);
});


// Data
// ====
local.schemes.register('data', function(request, response) {
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
	setTimeout(function() {
		response.writeHead(200, 'ok', {'content-type': contentType});
		response.end(data);
	});
});


// Local Server Registry
// =====================
var __httpl_registry = {};
var __peer_relay_registry = {}; // populated by PeerWebRelay startListening() and stopListening()

// EXPORTED
local.registerLocal = function registerLocal(domain, server, serverContext) {
	if (__httpl_registry[domain]) throw new Error("server already registered at domain given to registerLocal");

	var isServerObj = (server instanceof local.Server);
	if (isServerObj) {
		serverContext = server;
		server = server.handleLocalWebRequest;
		serverContext.config.domain = domain;
	}

	__httpl_registry[domain] = { fn: server, context: serverContext };
};

// EXPORTED
local.unregisterLocal = function unregisterLocal(domain) {
	if (__httpl_registry[domain]) {
		delete __httpl_registry[domain];
	}
};

// EXPORTED
local.getLocal = function getLocal(domain) {
	return __httpl_registry[domain];
};

// EXPORTED
local.getLocalRegistry = function getLocalRegistry() {
	return __httpl_registry;
};
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
local.dispatch = function dispatch(request) {
	if (!request) { throw new Error("no request param provided to request"); }
	if (typeof request == 'string')
		request = { url: request };
	if (!request.url) { throw new Error("no url on request"); }

	// If given a nav: scheme, spawn a navigator to handle it
	var scheme = parseScheme(request.url);
	if (scheme == 'nav') {
		var url = request.url;
		delete request.url;
		return local.navigator(url).dispatch(request);
	}

	// Prepare the request
	var body = null, shouldAutoSendRequestBody = false;
	if (!(request instanceof local.Request)) {
		body = request.body;
		request = new local.Request(request);
		shouldAutoSendRequestBody = true; // we're going to end()
	}
	Object.defineProperty(request, 'urld', { value: local.parseUri(request.url), configurable: true, enumerable: false, writable: true }); // (urld = url description)
	if (request.urld.query) {
		// Extract URL query parameters into the request's query object
		var q = local.contentTypes.deserialize('application/x-www-form-urlencoded', request.urld.query);
		for (var k in q)
			request.query[k] = q[k];
		request.urld.relative = request.urld.path + ((request.urld.anchor) ? ('#'+request.urld.anchor) : '');
		request.url = scheme+'://'+request.urld.authority+request.urld.relative;
	}
	request.serializeHeaders();

	// Setup response object
	var requestStartTime;
	var response = new local.Response();
	var response_ = local.promise();
	request.on('close', function() { response.close(); });
	response.on('headers', function() {
		response.deserializeHeaders();
		processResponseHeaders(request, response);
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
			local.fulfillResponsePromise(response_, response);
		});
	} else {
		// buffering, fulfill on 'close'
		response.on('close', function() {
			local.fulfillResponsePromise(response_, response);
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
		schemeHandler = schemeHandler || local.schemes.get(scheme);
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
			// autosend request body if not given a local.Request `request`
			if (shouldAutoSendRequestBody) { request.end(body); }
		}
		return response_;
	};

	// Setup the arguments list for the dispatch wrapper to include any additional params passed to dispatch()
	// aka (request, response, dispatch, args...)
	// this allows apps to do something like local.dispatch(request, extraParam1, extraParam2) and have the dispatch wrapper use those params
	var args = Array.prototype.slice.call(arguments, 1);
	args.unshift(dispatchFn);
	args.unshift(response);
	args.unshift(request);

	// Wait until next tick, to make sure dispatch() is always async
	setTimeout(function() {
		// Allow the wrapper to audit the message
		webDispatchWrapper.apply(null, args);
	}, 0);

	response_.request = request;
	return response_;
};

// EXPORTED
// fulfills/reject a promise for a response with the given response
// - exported because its pretty useful
local.fulfillResponsePromise = function(promise, response) {
	// wasnt streaming, fulfill now that full response is collected
	if (response.status >= 200 && response.status < 400)
		promise.fulfill(response);
	else if (response.status >= 400 && response.status < 600 || response.status === 0)
		promise.reject(response);
	else
		promise.fulfill(response); // :TODO: 1xx protocol handling
};

local.setDispatchWrapper = function(wrapperFn) {
	webDispatchWrapper = wrapperFn;
};

local.setDispatchWrapper(function(request, response, dispatch) {
	dispatch(request, response);
});

// INTERNAL
// Makes sure response header links are absolute
var isUrlAbsoluteRE = /(:\/\/)|(^[-A-z0-9]*\.[-A-z0-9]*)/; // has :// or starts with ___.___
function processResponseHeaders(request, response) {
	if (response.parsedHeaders.link) {
		response.parsedHeaders.link.forEach(function(link) {
			if (isUrlAbsoluteRE.test(link.href) === false)
				link.href = local.joinRelPath(request.urld, link.href);
		});
	}
}

// INTERNAL
function parseScheme(url) {
	var schemeMatch = /^([^.^:]*):/.exec(url);
	if (!schemeMatch) {
		// shorthand/default schemes
		if (url.indexOf('//') === 0)
			return 'http';
		else if (url.indexOf('||') === 0)
			return 'rel';
		else
			return 'httpl';
	}
	return schemeMatch[1];
}// Events
// ======

// subscribe()
// ===========
// EXPORTED
// Establishes a connection and begins an event stream
// - sends a GET request with 'text/event-stream' as the Accept header
// - `request`: request object, formed as in `dispatch()`
// - returns a `EventStream` object
local.subscribe = function subscribe(request) {
	if (typeof request == 'string')
		request = { url: request };
	request.stream = true; // stream the response
	if (!request.method) request.method = 'GET';
	if (!request.headers) request.headers = { accept : 'text/event-stream' };
	if (!request.headers.accept) request.headers.accept = 'text/event-stream';

	var response_ = local.dispatch(request);
	return new EventStream(response_.request, response_);
};


// EventStream
// ===========
// EXPORTED
// provided by subscribe() to manage the events
function EventStream(request, response_) {
	local.util.EventEmitter.call(this);
	this.request = request;
	this.response = null;
	this.response_ = null;
	this.lastEventId = -1;
	this.isConnOpen = true;

	this.connect(response_);
}
local.EventStream = EventStream;
EventStream.prototype = Object.create(local.util.EventEmitter.prototype);
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

	// Re-establish the connection
	this.request = new local.Request(this.request);
	if (!this.request.headers) this.request.headers = {};
	if (this.lastEventId) this.request.headers['last-event-id'] = this.lastEventId;
	this.connect(local.dispatch(this.request));
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
	e = local.contentTypes.deserialize('text/event-stream', e);
	var id = parseInt(e.id, 10);
	if (typeof id != 'undefined' && id > this.lastEventId)
		this.lastEventId = id;
	this.emit('message', e);
	this.emit(e.event, e);
}


// Broadcaster
// ===========
// EXPORTED
// a wrapper for event-streams
function Broadcaster() {
	this.streams = [];
}
local.Broadcaster = Broadcaster;

// listener management
Broadcaster.prototype.addStream = function(responseStream) {
	responseStream.broadcastStreamId = this.streams.length;
	this.streams.push(responseStream);
	var self = this;
	responseStream.on('close', function() {
		self.endStream(responseStream);
	});
	return responseStream.broadcastStreamId;
};
Broadcaster.prototype.endStream = function(responseStream) {
	if (typeof responseStream == 'number') {
		responseStream = this.streams[responseStream];
	}
	delete this.streams[responseStream.broadcastStreamId];
	responseStream.end();
};
Broadcaster.prototype.endAllStreams = function() {
	this.streams.forEach(function(rS) { rS.end(); });
	this.streams.length = 0;
};

// Sends an event to all streams
// - `opts.exclude`: optional number|Response|[number]|[Response], streams not to send to
Broadcaster.prototype.emit = function(eventName, data, opts) {
	if (!opts) opts = {};
	if (opts.exclude) {
		if (!Array.isArray(opts.exclude)) {
			opts.exclude = [opts.exclude];
		}
		// Convert to ids
		opts.exclude = opts.exclude.map(function(v) {
			if (v instanceof local.Response) {
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
Broadcaster.prototype.emitTo = function(responseStream, eventName, data) {
	if (typeof responseStream == 'number') {
		responseStream = this.streams[responseStream];
	}
	responseStream.write({ event: eventName, data: data });
};

// wrap helper
local.broadcaster = function() {
	return new Broadcaster();
};
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
        "use strict";
        local.UriTemplate = UriTemplate;
}));// Navigator
// =========

function getEnvironmentHost() {
	if (typeof window !== 'undefined') return window.location.host;
	if (app) return app.config.environmentHost; // must be passed to in the ready config
	return '';
}

// NavigatorContext
// ================
// INTERNAL
// information about the resource that a navigator targets
//  - exists in an "unresolved" state until the URI is confirmed by a response from the server
//  - enters a "bad" state if an attempt to resolve the link failed
//  - may be "relative" if described by a relation from another context (eg a query or a relative URI)
//  - may be "absolute" if described by an absolute URI
// :NOTE: absolute contexts may have a URI without being resolved, so don't take the presence of a URI as a sign that the resource exists
function NavigatorContext(query) {
	this.query = query;
	this.resolveState = NavigatorContext.UNRESOLVED;
	this.error = null;
	this.queryIsAbsolute = (typeof query == 'string' && local.isAbsUri(query));
	if (this.queryIsAbsolute) {
		this.url  = query;
		this.urld = local.parseUri(this.url);
	} else {
		this.url = null;
		this.urld = null;
	}
}
NavigatorContext.UNRESOLVED = 0;
NavigatorContext.RESOLVED   = 1;
NavigatorContext.FAILED     = 2;
NavigatorContext.prototype.isResolved = function() { return this.resolveState === NavigatorContext.RESOLVED; };
NavigatorContext.prototype.isBad      = function() { return this.resolveState === NavigatorContext.FAILED; };
NavigatorContext.prototype.isRelative = function() { return (!this.queryIsAbsolute); };
NavigatorContext.prototype.isAbsolute = function() { return this.queryIsAbsolute; };
NavigatorContext.prototype.getUrl     = function() { return this.url; };
NavigatorContext.prototype.getError   = function() { return this.error; };
NavigatorContext.prototype.resetResolvedState = function() {
	this.resolveState = NavigatorContext.UNRESOLVED;
	this.error = null;
};
NavigatorContext.prototype.setResolved = function(url) {
	this.error        = null;
	this.resolveState = NavigatorContext.RESOLVED;
	if (url) {
		this.url          = url;
		this.urld         = local.parseUri(this.url);
	}
};
NavigatorContext.prototype.setFailed = function(error) {
	this.error        = error;
	this.resolveState = NavigatorContext.FAILED;
};

// Navigator
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
var foobarService = local.navigator('https://foobar.com');
var bob = foobarService.follow('|collection=users|item=bob');
// ^ or local.navigator('nav:||https://foobar.com|collection=users|item=bob')
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
function Navigator(context, parentNavigator) {
	this.context         = context         || null;
	this.parentNavigator = parentNavigator || null;
	this.links           = null;
	this.requestDefaults = null;
}
local.Navigator = Navigator;

// Sets defaults to be used in all requests
// - eg nav.setRequestDefaults({ method: 'GET', headers: { authorization: 'bob:pass', accept: 'text/html' }})
// - eg nav.setRequestDefaults({ proxy: 'httpl://myproxy.app' })
Navigator.prototype.setRequestDefaults = function(v) {
	this.requestDefaults = v;
};

// Helper to copy over request defaults
function copyDefaults(target, defaults) {
	for (var k in defaults) {
		if (k == 'headers' || !!target[k])
			continue;
		// ^ headers should be copied per-attribute
		if (typeof defaults[k] == 'object')
			target[k] = local.util.deepClone(defaults[k]);
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
//    - retry: bool, should the url resolve be tried if it previously failed?
Navigator.prototype.dispatch = function(req) {
	if (!req) req = {};
	if (!req.headers) req.headers = {};
	var self = this;

	if (this.requestDefaults)
		copyDefaults(req, this.requestDefaults);

	// Resolve our target URL
	return ((req.url) ? local.promise(req.url) : this.resolve({ retry: req.retry, nohead: true }))
		.succeed(function(url) {
			req.url = url;
			return local.dispatch(req);
		})
		.succeed(function(res) {
			// After every successful request, update our links and mark our context as good (in case it had been bad)
			self.context.setResolved();
			if (res.parsedHeaders.link) self.links = res.parsedHeaders.link;
			else self.links = self.links || []; // cache an empty link list so we dont keep trying during resolution
			return res;
		})
		.fail(function(res) {
			// Let a 1 or 404 indicate a bad context (as opposed to some non-navigational error like a bad request body)
			if (res.status === local.LINK_NOT_FOUND || res.status === 404)
				self.context.setFailed(res);
			throw res;
		});
};

// Executes a GET text/event-stream request to our context
Navigator.prototype.subscribe = function(req) {
	var self = this;
	if (!req) req = {};
	return this.resolve({ nohead: true }).succeed(function(url) {
		req.url = url;

		if (self.requestDefaults)
			copyDefaults(req, self.requestDefaults);

		return local.subscribe(req);
	});
};

// Follows a link relation from our context, generating a new navigator
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
Navigator.prototype.follow = function(query) {
	// convert nav: uri to a query array
	if (typeof query == 'string' && local.isNavSchemeUri(query))
		query = local.parseNavUri(query);

	// make sure we always have an array
	if (!Array.isArray(query))
		query = [query];

	// build a full follow() chain
	var nav = this;
	do {
		nav = new Navigator(new NavigatorContext(query.shift()), nav);
		if (this.requestDefaults)
			nav.setRequestDefaults(this.requestDefaults);
	} while (query[0]);

	return nav;
};

// Resets the navigator's resolution state, causing it to reissue HEAD requests (relative to any parent navigators)
Navigator.prototype.unresolve = function() {
	this.context.resetResolvedState();
	this.links = null;
	return this;
};

// Reassigns the navigator to a new absolute URL
// - `url`: required string, the URL to rebase the navigator to
// - resets the resolved state
Navigator.prototype.rebase = function(url) {
	this.unresolve();
	this.context.query = url;
	this.context.queryIsAbsolute = true;
	this.context.url  = url;
	this.context.urld = local.parseUri(url);
	return this;
};

// Resolves the navigator's URL, reporting failure if a link or resource is unfound
//  - also ensures the links have been retrieved from the context
//  - may trigger resolution of parent contexts
//  - options is optional and may include:
//    - retry: bool, should the resolve be tried if it previously failed?
//    - nohead: bool, should we issue a HEAD request once we have a URL? (not favorable if planning to dispatch something else)
//  - returns a promise which will fulfill with the resolved url
Navigator.prototype.resolve = function(options) {
	var self = this;
	options = options || {};

	var nohead = options.nohead;
	delete options.nohead;
	// ^ pull `nohead` out so that parent resolves are `nohead: false` - we do want them to dispatch HEAD requests to resolve us

	var resolvePromise = local.promise();
	if (this.links !== null && (this.context.isResolved() || (this.context.isAbsolute() && this.context.isBad() === false))) {
		// We have links and we were previously resolved (or we're absolute so there's no need)
		resolvePromise.fulfill(this.context.getUrl());
	} else if (this.context.isBad() === false || (this.context.isBad() && options.retry)) {
		// We don't have links, and we haven't previously failed (or we want to try again)
		this.context.resetResolvedState();

		if (this.context.isRelative() && !this.parentNavigator) {
			// Scheme-less URIs can map to local URIs, so make sure the local server hasnt been added since we were created
			if (typeof this.context.query == 'string' && !!local.getLocal(this.context.query)) {
				self.context = new NavigatorContext(self.context.query);
			} else {
				self.context.setFailed({ status: 404, reason: 'not found' });
				resolvePromise.reject(this.context.getError());
				return resolvePromise;
			}
		}

		if (this.context.isRelative()) {
			// Up the chain we go
			resolvePromise = this.parentNavigator.resolve(options)
				.succeed(function() {
					// Parent resolved, query its links
					var childUrl = self.parentNavigator.lookupLink(self.context);
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
					var response = new local.Response();
					response.writeHead(local.LINK_NOT_FOUND, 'link query failed to match').end();
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
Navigator.prototype.lookupLink = function(context) {
	if (context.query) {
		if (typeof context.query == 'object') {
			// Try to find a link that matches
			var link = local.queryLinks(this.links, context.query)[0];
			if (link)
				return local.UriTemplate.parse(link.href).expand(context.query);
		}
		else if (typeof context.query == 'string') {
			// A URL
			if (!local.isAbsUrl(context.query))
				return local.joinRelPath(this.context.urld, context.query);
			return context.query;
		}
	}
	console.log('Failed to find a link to resolve context. Link query:', context.query, 'Navigator:', this);
	return null;
};

// Dispatch Sugars
// ===============
function makeDispSugar(method) {
	return function(headers, options) {
		var req = options || {};
		req.headers = headers || {};
		req.method = method;
		return this.dispatch(req);
	};
}
function makeDispWBodySugar(method) {
	return function(body, headers, options) {
		var req = options || {};
		req.headers = headers || {};
		req.method = method;
		req.body = body;
		return this.dispatch(req);
	};
}
Navigator.prototype.head   = makeDispSugar('HEAD');
Navigator.prototype.get    = makeDispSugar('GET');
Navigator.prototype.delete = makeDispSugar('DELETE');
Navigator.prototype.post   = makeDispWBodySugar('POST');
Navigator.prototype.put    = makeDispWBodySugar('PUT');
Navigator.prototype.patch  = makeDispWBodySugar('PATCH');
Navigator.prototype.notify = makeDispWBodySugar('NOTIFY');

// Builder
// =======
local.navigator = function(queryOrNav) {
	if (queryOrNav instanceof Navigator)
		return queryOrNav;

	// convert nav: uri to a query array
	if (typeof queryOrNav == 'string' && local.isNavSchemeUri(queryOrNav))
		queryOrNav = local.parseNavUri(queryOrNav);

	// make sure we always have an array
	if (!Array.isArray(queryOrNav))
		queryOrNav = [queryOrNav];

	// build a full follow() chain
	var nav = new Navigator(new NavigatorContext(queryOrNav.shift()));
	while (queryOrNav[0]) {
		nav = new Navigator(new NavigatorContext(queryOrNav.shift()), nav);
	}

	return nav;
};// Local Registry Host
local.registerLocal('hosts', function(req, res) {
	var localHosts = local.getLocalRegistry();

	if (!(req.method == 'HEAD' || req.method == 'GET'))
		return res.writeHead(405, 'bad method').end();

	if (req.method == 'GET' && !local.preferredType(req, 'application/json'))
		return res.writeHead(406, 'bad accept - only provides application/json').end();

	var responses_ = [];
	var domains = [], links = [];
	links.push({ href: '/', rel: 'self service via', id: 'hosts' });
	for (var domain in localHosts) {
		if (domain == 'hosts')
			continue;
		domains.push(domain);
		responses_.push(local.dispatch({ method: 'HEAD', url: 'httpl://'+domain }));
	}

	local.promise.bundle(responses_).then(function(ress) {
		ress.forEach(function(res, i) {
			var selfLink = local.queryLinks(res, { rel: 'self' })[0];
			if (!selfLink) {
				selfLink = { rel: 'service', id: domains[i], href: 'httpl://'+domains[i] };
			}
			selfLink.rel = (selfLink.rel) ? selfLink.rel.replace(/(^|\s)self(\s|$)/i, '') : 'service';
			links.push(selfLink);
		});

		res.setHeader('link', links);
		if (req.method == 'HEAD')
			return res.writeHead(204, 'ok, no content').end();
		res.writeHead(200, 'ok', { 'content-type': 'application/json' });
		res.end({ host_names: domains });
	});
});})();// Local Toplevel
// ==============
// pfraze 2013

if (typeof this.local == 'undefined')
	this.local = {};

(function() {local.workerBootstrapUrl = 'worker.min.js';
local.logAllExceptions = false;// Helpers to create servers
// -

// EXPORTED
// Creates a Web Worker and a bridge server to the worker
// eg `local.spawnWorkerServer('http://foo.com/myworker.js', localServerFn, )
// - `src`: required string, the URI to load into the worker
// - `config`: optional object, additional config options to pass to the worker
// - `config.domain`: optional string, overrides the automatic domain generation
// - `config.shared`: boolean, should the workerserver be shared?
// - `config.namespace`: optional string, what should the shared worker be named?
//   - defaults to `config.src` if undefined
// - `config.nullify`: optional [string], a list of objects to nullify when the worker loads
//   - defaults to ['XMLHttpRequest', 'Worker', 'WebSocket', 'EventSource']
// - `config.bootstrapUrl`: optional string, specifies the URL of the worker bootstrap script
// - `serverFn`: optional function, a response generator for requests from the worker
local.spawnWorkerServer = function(src, config, serverFn) {
	if (typeof config == 'function') { serverFn = config; config = null; }
	if (!config) { config = {}; }
	config.src = src;
	config.serverFn = serverFn;

	// Create the server
	var server = new local.WorkerBridgeServer(config);

	// Find an open domain and register
	var domain = config.domain;
	if (!domain) {
		if (src.indexOf('data:') === 0) {
			domain = getAvailableLocalDomain('worker{n}');
		} else {
			domain = getAvailableLocalDomain(src.split('/').pop().toLowerCase() + '{n}');
		}
	}
	local.registerLocal(domain, server);

	return server;
};

// EXPORTED
// Opens a stream to a peer relay
// - `providerUrl`: optional string, the relay provider
// - `config.app`: optional string, the app to join as (defaults to window.location.host)
// - `serverFn`: optional function, a response generator for requests from connected peers
local.joinPeerRelay = function(providerUrl, config, serverFn) {
	if (typeof config == 'function') { serverFn = config; config = null; }
	if (!config) config = {};
	config.provider = providerUrl;
	config.serverFn = serverFn;
	return new local.PeerWebRelay(config);
};

// helper for name assignment
function getAvailableLocalDomain(base) {
	var i = '', str;
	do {
		str = base.replace('{n}', i);
		i = (!i) ? 2 : i + 1;
	} while (local.getLocal(str));
	return str;
}// Standard DOM Events
// ===================

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
		handler = { name: 'click', handleEvent: Local__clickHandler, container: container };
		container.addEventListener('click', handler, false);
		container.__localEventHandlers.push(handler);
	}
	if (options.forms !== false) {
		handler = { name: 'submit', handleEvent: Local__submitHandler, container: container };
		container.addEventListener('submit', handler, false);
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
	local.util.trackFormSubmitter(e.target);
	var request = local.util.extractRequest.fromAnchor(e.target);
	if (request && ['_top','_blank'].indexOf(request.target) !== -1) { return; }
	if (request) {
		e.preventDefault();
		e.stopPropagation();
		local.util.dispatchRequestEvent(e.target, request);
		return false;
	}
}

// INTERNAL
// transforms submit events into request events
function Local__submitHandler(e) {
	var request = local.util.extractRequest(e.target, this.container);
	if (request && ['_top','_blank'].indexOf(request.target) !== -1) { return; }
	if (request) {
		e.preventDefault();
		e.stopPropagation();
		local.util.finishPayloadFileReads(request).then(function() {
			local.util.dispatchRequestEvent(e.target, request);
		});
		return false;
	}
}

local.bindRequestEvents = bindRequestEvents;
local.unbindRequestEvents = unbindRequestEvents;})();