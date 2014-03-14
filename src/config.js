// Worker API whitelisting code
// ============================
var whitelist = [ // a list of global objects which are allowed in the worker
	'null', 'self', 'console', 'atob', 'btoa',
	'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
	'Proxy',
	'importScripts', 'navigator',
	'postMessage', 'addEventListener', 'removeEventListener',
	'onmessage', 'onerror', 'onclose',
	'dispatchEvent'
];
var blacklist = [ // a list of global objects which are not allowed in the worker, and which dont enumerate on `self` for some reason
	'XMLHttpRequest', 'WebSocket', 'EventSource',
	'Worker'
];
var whitelistAPIs_src = [ // nullifies all toplevel variables except those listed above in `whitelist`
	'(function() {',
		'var nulleds=[];',
		'var whitelist = ["'+whitelist.join('", "')+'"];',
		'for (var k in self) {',
			'if (whitelist.indexOf(k) === -1) {',
				'Object.defineProperty(self, k, { value: null, configurable: false, writable: false });',
				'nulleds.push(k);',
			'}',
		'}',
		'var blacklist = ["'+blacklist.join('", "')+'"];',
		'blacklist.forEach(function(k) {',
			'Object.defineProperty(self, k, { value: null, configurable: false, writable: false });',
			'nulleds.push(k);',
		'});',
		'if (typeof console != "undefined") { console.log("Nullified: "+nulleds.join(", ")); }',
	'})();\n'
].join('');
var importScriptsPatch_src;
if (typeof window != 'undefined') {
	var host = window.location.protocol + '//' + window.location.host;
	var hostDir = window.location.pathname.split('/').slice(0,-1).join('/');
	var hostWithDir = host + hostDir;
	importScriptsPatch_src = [ // patches importScripts() to allow relative paths despite the use of blob uris
		'(function() {',
			'var orgImportScripts = importScripts;',
			'function joinRelPath(base, relpath) {',
				'if (relpath.charAt(0) == \'/\') {',
					'return "'+host+'" + relpath;',
				'}',
				'// totally relative, oh god',
				'// (thanks to geoff parker for this)',
				'var hostpath = "'+hostDir+'";',
				'var hostpathParts = hostpath.split(\'/\');',
				'var relpathParts = relpath.split(\'/\');',
				'for (var i=0, ii=relpathParts.length; i < ii; i++) {',
					'if (relpathParts[i] == \'.\')',
						'continue; // noop',
					'if (relpathParts[i] == \'..\')',
						'hostpathParts.pop();',
					'else',
						'hostpathParts.push(relpathParts[i]);',
				'}',
				'return "'+host+'/" + hostpathParts.join(\'/\');',
			'}',
			'var isImportingAllowed = true;',
			'setTimeout(function() { isImportingAllowed = false; },0);', // disable after initial import
			'importScripts = function() {',
				'if (!isImportingAllowed) { throw "Local.js - Imports disabled after initial load to prevent data-leaking"; }',
				'return orgImportScripts.apply(null, Array.prototype.map.call(arguments, function(v, i) {',
					'return (v.indexOf(\'/\') < v.indexOf(/[.:]/) || v.charAt(0) == \'/\' || v.charAt(0) == \'.\') ? joinRelPath(\''+hostWithDir+'\',v) : v;',
				'}));',
			'};',
		'})();\n'
	].join('\n');
} else { importScriptsPatch_src = ''; }

module.exports = {
	logAllExceptions: false,
	workerBootstrapScript: whitelistAPIs_src+importScriptsPatch_src
};