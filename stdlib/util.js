// Utilities
// =========

if (typeof Util == 'undefined') {
	(function() {
		var Util = this.Util = {};
		var active_log_modes = {}; // enabled logging mods

		// http://keithdevens.com/weblog/archive/2007/Jun/07/javascript.clone
		Util.deepCopy = function deepCopy(obj) {
			if (!obj || typeof obj != 'object') { return obj; }
			var c = new obj.constructor();
			for (var k in obj) { c[k] = deepCopy(obj[k]); }
			return c;
		};

		Util.logMode = function logMode(k, v) {
			if (v === undefined) { return active_log_modes[k]; }
			active_log_modes[k] = v;
			return v;
		};

		Util.log = function log(channel) {
			if (Util.logMode(channel)) {
				var args = Array.prototype.slice.call(arguments, 1);
				if (typeof console != 'undefined')
					console.log.apply(console, args);
				else if (typeof postEventMsg != 'undefined')
					postEventMsg('log', { msg:args.join(' ') })
			}
		};
		
	}).call(globals);
}