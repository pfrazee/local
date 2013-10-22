// Local Worker Tools
// ==================
// pfraze 2013

if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {

	if (typeof this.local.worker == 'undefined')
		this.local.worker = {};

	(function() {