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

function getFnName(fn) {
  if (typeof fn !== 'function') return '';
  if (fn.name) return fn.name;
  var match = fn.toString().match(/function ([^\(]+)/);
  return (match) ? match[1] : '';
}

// helper to make an array of objects
// - takes an array of keys (the table "header")
// - consumes the remaining arguments as table values
// table(['hello, goodye'], 'world', 'kids') // => { hello: 'world', goodbye: 'kids' }
function table(keys) {
	var obj, i, j=-1;
	var arr = [];
	for (i=1, j; i < arguments.length; i++, j++) {
		if (!keys[j]) { if (obj) { arr.push(obj); } obj = {}; j = 0; } // new object
        if (typeof arguments[i] == 'undefined') continue; // skip undefineds
		obj[keys[j]] = arguments[i];
	}
	arr.push(obj); // dont forget the last one
	return arr;
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
	getFnName: getFnName,
    table: table,
	nextTick: nextTick
};
mixin.call(module.exports, DOM);