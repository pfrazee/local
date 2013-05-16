// Setup
// =====
var closureImportScripts = importScripts; // self.importScripts will be nullified later
var closureXMLHttpRequest = XMLHttpRequest; // self.XMLHttpRequest will be nullified later

// EXPORTED
// sends log message
local.worker.log = function log() {
	var args = Array.prototype.slice.call(arguments);
	if (args.length == 1)
		args = args[0];
	try { local.worker.postNamedMessage('log', args); }
	catch (e) {
		// this is usually caused by trying to log information that cant be serialized
		local.worker.postNamedMessage('log', JSONifyMessage(args));
	}
};
self.console = {};
self.console.log = local.worker.log;

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
// logs the current stack
local.worker.logStack = function() {
	try { stack_trace._fake+=0; }
	catch(e) { console.log(e.stack); }
};

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

// EXPORTED
// GETs a resource, then wraps it in a closure and returns as a variable
// - SYNCRONOUS: blocks until GET finishes or times out
// - if the content type or extension is .js, will run `importScripts` after wrapping in a `module.exports` closure
// - otherwise, returns content as a string
self.require = function(url) {
	if (local.worker.config && url.indexOf('://') === -1 && url.charAt(0) != '/') // relative url?
		url = local.worker.config.srcBaseUrl + url; // make relative to user script's location

	if (url in self.modules)
		return self.modules[url];

	var request = new closureXMLHttpRequest();
	request.open('GET', url, false);
	request.send(null);
	if (request.status >= 200 && request.status < 300) {
		if (/\.js$/.test(url)) {
			closureImportScripts(makeExportClosure(url, request.responseText));
			return self.modules[url];
		} else {
			self.modules[url] = request.responseText;
			return request.responseText;
		}
	}
	console.log('Failed to require('+url+') - '+request.status);
	return null;
};
self.modules = {};
function makeExportClosure(url, src) {
	src = '(function(){ var module = { exports:{} }; ' + src + '; self.modules["'+url+'"] = module.exports; })();';
	return 'data:text/javascript;base64,'+btoa(src);
}

// Document Commands
// removes an object from use
local.worker.onNamedMessage('nullify', function(message) {
	console.log('nullifying: ' + message.data);
	if (message && typeof message.data === 'string') {
		// destroy the top-level reference
		self[message.data] = null;
	} else {
		throw "'nullify' message must include a valid string";
	}
});

// imports the script at/in the given uri
local.worker.onNamedMessage('importScripts', function(message) {
	console.log('importingScripts: ' + message.data);
	if (message && message.data) {
		try {
			closureImportScripts(message.data);
		} catch(e) {
			local.worker.postReply(message, { error:true, reason:(e ? e.toString() : e) });
			throw e;
		}
	} else {
		throw "'importScripts' message must include a valid array/string";
	}
	local.worker.postReply(message, { error:false });
});

// let the document know we've loaded
local.worker.postNamedMessage('ready', null, function(reply) {
	local.worker.config = reply.data;
});