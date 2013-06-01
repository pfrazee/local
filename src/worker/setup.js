// Setup
// =====

// create connection to host page
local.worker.hostConnection = new local.worker.PageConnection(this, true);
var hostConn = local.worker.hostConnection;
local.worker.startWebExchange(hostConn);

// ops-exchange handlers
// -
hostConn.onMessage(hostConn.ops, 'configure', function(message) {
	local.worker.config = message.data;
});

hostConn.onMessage(hostConn.ops, 'nullify', function(message) {
	console.log('nullifying: ' + message.data);
	if (typeof message.data === 'string')
		self[message.data] = null; // destroy the top-level reference
	else
		throw "'nullify' message must include a valid string";
});

hostConn.onExchange('importScripts', function(exchange) {
	hostConn.onMessage(exchange, 'urls', function(message) {
		console.log('importingScripts: ' + message.data);
		if (message && message.data) {
			try {
				closureImportScripts(message.data);
			} catch(e) {
				hostConn.sendMessage(message.exchange, 'done', { error: true, reason: (e ? e.toString() : e) });
				hostConn.endExchange(message.exchange);
				throw e;
			}
		} else {
			hostConn.sendMessage(message.exchange, 'done', { error: true, reason: (e ? e.toString() : e) });
			hostConn.endExchange(message.exchange);
			throw "'importScripts' message must include a valid array/string";
		}
		hostConn.sendMessage(message.exchange, 'done', { error: false });
		hostConn.endExchange(message.exchange);
	});
});


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

// let the document know we've loaded
hostConn.sendMessage(hostConn.ops, 'ready');