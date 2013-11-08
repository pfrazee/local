// Local Worker Tools
// ==================
// pfraze 2013

if (typeof self != 'undefined' && typeof self.window == 'undefined') {

	if (typeof this.local.worker == 'undefined')
		this.local.worker = {};

	(function() {