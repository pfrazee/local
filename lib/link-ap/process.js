var cur_pid = 1;
function gen_pid() { return cur_pid++; }

function Process(scriptUrl) {
	this.config = Object.freeze({
		pid       : gen_pid(),
		scriptUrl : scriptUrl
	});
	this.state = Process.BOOT;

	this.worker = new MyHouse.Sandbox();
	this.worker.onMessage('ready', this.onWorkerReady, this);
	this.worker.onMessage('loaded', this.onWorkerLoaded, this);
	this.worker.onMessage('terminate', this.onWorkerTerminate, this);
}

// EXPORTED
// possible states
Process.BOOT   = 0;
Process.READY  = 1;
Process.ACTIVE = 2;
Process.DEAD   = 3;

Process.prototype.onWorkerReady = function(message) {
	this.state = Process.READY;
	this.worker.postReply(message, { pid:this.config.pid }); // reply to 'ready' with the process config
	this.worker.nullify('XMLHttpRequest'); // disable ajax
	this.worker.importScripts(this.scriptUrl); // load the program
};

Process.prototype.onWorkerLoaded = function(message) {
	this.state = Process.ACTIVE;
};

Process.prototype.onWorkerTerminate = function(message) {
	this.state = Process.DEAD;
	this.worker.terminate();
};

