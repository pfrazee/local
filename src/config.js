// Worker API whitelisting code
// ============================
var localjsUrl = '';
if (typeof self.document !== 'undefined') { // in the page
    try { localjsUrl = document.querySelector('script[src$="local.js"]').src; }
    catch (e) {
        try { localjsUrl = document.querySelector('script[src$="local.min.js"]').src; }
        catch (e) {
            console.error('Unable to find local.js or local.min.js script tags; unable to setup worker scripts');
        }
    }
}
var localjsImport_src = 'importScripts("'+localjsUrl+'");\n';
var whitelist = [ // a list of global objects which are allowed in the worker
    // defined by local.js
    'web', 'pageBridge',
    'HEAD', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'SUBSCRIBE', 'NOTIFY', 'from',

	'null', 'self', 'console', 'atob', 'btoa',
	'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
	'Proxy',
	'navigator',
	'postMessage', 'addEventListener', 'removeEventListener',
	'onmessage', 'onerror', 'onclose',
	'dispatchEvent'
];
var blacklist = [ // a list of global objects which are not allowed in the worker, and which dont enumerate on `self` for some reason
	'XMLHttpRequest', 'WebSocket', 'EventSource',
    'FileReaderSync',
	'Worker', 'importScripts'
];
var whitelistAPIs_src = [ // nullifies all toplevel variables except those listed above in `whitelist`
	'(function() {',
	'   var nulleds=[];',
	'	var whitelist = ["'+whitelist.join('", "')+'"];',
	'	for (var k in self) {',
	'		if (whitelist.indexOf(k) === -1) {',
	'			Object.defineProperty(self, k, { value: null, configurable: false, writable: false });',
	'			nulleds.push(k);',
	'		}',
	'	}',
	'	var blacklist = ["'+blacklist.join('", "')+'"];',
	'	blacklist.forEach(function(k) {',
	'		Object.defineProperty(self, k, { value: null, configurable: false, writable: false });',
	'		nulleds.push(k);',
	'	});',
	'	if (typeof console != "undefined") { console.log("Nullified: "+nulleds.join(", ")); }',
	'})();\n'
].join('\n');
var isInWorker = (typeof self.document == 'undefined');
module.exports = {
    logTraffic: true,
	logAllExceptions: false,
    maxActiveWorkers: 10,
    virtualOnly: isInWorker ? true : false,
    localOnly: isInWorker ? true : false,
	workerBootstrapScript: localjsImport_src+whitelistAPIs_src
};