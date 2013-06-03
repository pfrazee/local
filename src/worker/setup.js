// Setup
// =====
var closureImportScripts = importScripts; // self.importScripts will be nullified later (and we're in a closure right now)

// apis
// -

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
	var hostConn = local.worker.hostConnection;
	try { hostConn.sendMessage(hostConn.ops, 'log', [type].concat(args)); }
	catch (e) {
		// this is usually caused by trying to log information that cant be serialized
		hostConn.sendMessage(hostConn.ops, 'log', [type].concat(args.map(JSONifyMessage)));
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

// setup for future connections (shared worker)
addEventListener('connect', function(e) {
	var isHost = (!local.worker.hostConnection);
	var conn = new local.worker.PageConnection(e.ports[0], isHost);
	if (isHost)
		local.worker.hostConnection = conn;
	local.worker.startWebExchange(conn);

	// let the document know we're active
	e.ports[0].start();
	conn.sendMessage(conn.ops, 'ready', { hostPrivileges: isHost });
});

// create connection to host page (regular worker)
if (self.postMessage) {
	local.worker.hostConnection = new local.worker.PageConnection(this, true);
	local.worker.startWebExchange(local.worker.hostConnection);
	local.worker.hostConnection.sendMessage(0, 'ready', { hostPrivileges: true });
}