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