// http://jsperf.com/cloning-an-object/2
local.util.deepClone = function(obj) {
	return JSON.parse(JSON.stringify(obj));
};


// fallback for other environments / postMessage behaves badly on IE8
if (typeof window == 'undefined' || window.ActiveXObject || !window.postMessage) {
	local.util.nextTick = function(fn) { setTimeout(fn, 0); };
} else {
	var nextTickIndex = 0, nextTickFns = {};
	local.util.nextTick = function(fn) {
		window.postMessage('nextTick'+nextTickIndex, '*');
		nextTickFns['nextTick'+nextTickIndex] = fn;
		nextTickIndex++;
	};
	window.addEventListener('message', function(evt){
		var fn = nextTickFns[evt.data];
		delete nextTickFns[evt.data];
		fn();
	}, true);

	// The following is the original version by // https://github.com/timoxley/next-tick
	// It was replaced by the above to avoid the try/catch block
	/*
	var nextTickQueue = [];
	local.util.nextTick = function(fn) {
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