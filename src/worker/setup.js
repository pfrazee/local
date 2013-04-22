// Setup
// =====

// EXPORTED
// sends log message
local.worker.log = function log() {
	var args = Array.prototype.slice.call(arguments);
	if (args.length > 1) {
		local.worker.postNamedMessage('log', args);
	} else {
		local.worker.postNamedMessage('log', args[0]);
	}
};
var console = {};
console.log = local.worker.log;

// EXPORTED
// logs the current stack
local.worker.logStack = function() {
	try { stack_trace._fake+=0; }
	catch(e) { console.log(e.stack); }
};

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
			self.importScripts(message.data);
		} catch(e) {
			local.worker.postReply(message, { error:true, reason:e.toString() });
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