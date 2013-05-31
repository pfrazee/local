// Local HTTP
// ==========
// pfraze 2013

if (typeof this.local == 'undefined')
	this.local = {};
if (typeof this.local.http == 'undefined')
	this.local.http = {};
if (typeof this.local.http.ext == 'undefined')
	this.local.http.ext = {};

(function() {
	function noop() {}