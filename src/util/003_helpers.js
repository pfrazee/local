// http://jsperf.com/cloning-an-object/2
local.util.deepClone = function(obj) {
	return JSON.parse(JSON.stringify(obj));
};

// https://github.com/timoxley/next-tick
// fallback for other environments / postMessage behaves badly on IE8
if (typeof window == 'undefined' || window.ActiveXObject || !window.postMessage) {
	local.util.nextTick = function(fn) { setTimeout(fn, 0); };
} else {
	var nextTickQueue = [];
	local.util.nextTick = function(fn) {
		if (!nextTickQueue.length) window.postMessage('nextTick', '*');
		nextTickQueue.push(fn);
	};
	window.addEventListener('message', function(){
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
}