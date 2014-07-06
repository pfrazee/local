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
	if (value !== void 0)
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