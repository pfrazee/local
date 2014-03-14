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