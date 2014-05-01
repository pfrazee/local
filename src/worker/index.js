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