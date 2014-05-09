var helpers = require('./helpers.js');
var promise = require('../promises.js').promise;
var Bridge = require('./bridge.js');

module.exports = {
	getWorker: get,
	spawnWorker: spawnWorker,
	spawnTempWorker: spawnTempWorker
};

var _workers = {};
var _bridges = {};
// a map of known protocols for http/s domains
// (reduces the frequency of failed HTTPS lookups when loading scripts without a scheme)
var _domainSchemes = {};

// lookup active worker by urld
function get(urld) {
	if (typeof urld == 'string') {
		urld = helpers.parseUri(urld);
	}

	// Relative to current host? Construct full URL
	if (!urld.authority || urld.authority == '.' || urld.authority.indexOf('.') === -1) {
		var dir = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'));
		var dirurl = window.location.origin + dir;
		var url = helpers.joinRelPath(dirurl, urld.source);
		urld = local.parseUri(url);
	}

	// Lookup from existing children
    var id = urld.authority+urld.path;
	var bridge = _bridges[id];
	if (bridge) {
		return bridge.onRequest.bind(bridge);
	}

	// Nothing exists yet - is it a .js?
	if (urld.path.slice(-3) == '.js') {
		// Try to autoload temp worker
		spawnTempWorker(urld);
        var bridge = _bridges[id];
		return bridge.onRequest.bind(bridge);
	}

	// Send back a failure responder
	return function(req, res) {
		res.status(0, 'request to '+url.source+' expects '+urld.path+' to be a .js file');
		res.end();
	};
}

function spawnTempWorker(urld) {
	var worker = spawnWorker(urld);
	worker.setTemporary();
	return worker;
}

function spawnWorker(urld) {
	if (typeof urld == 'string') {
		urld = helpers.parseUri(urld);
	}

	// Relative to current host? Construct full URL
	if (!urld.authority || urld.authority == '.' || urld.authority.indexOf('.') === -1) {
		var dir = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'));
		var dirurl = window.location.protocol + '//' + window.location.hostname + dir;
		var url = helpers.joinRelPath(dirurl, urld.source);
		urld = local.parseUri(url);
	}

	// Eject a temp server if needed
	if (Object.keys(_workers).length >= local.maxActiveWorkers) {
        var eject = null;
	    for (var d in _workers) {
		    if ( _workers[d].isTemp && !_bridges[d].isInTransaction()) {
                eject = d;
                break;
            }
	    }
		console.log('Closing temporary worker', eject);
		_workers[eject].terminate();
        delete _workers[eject];
        delete _bridges[eject];
	}

    var id = urld.authority+urld.path;
	var worker = new WorkerWrapper(id);
	_workers[id] = worker;
    _bridges[id] = new Bridge(worker);
	worker.load(urld);
	return worker;
}

function WorkerWrapper(id) {
	this.isReady = false;
	this.isTemp = false;

    this.id = id;
	this.worker = null;

	this.script_blob = null;
	this.script_objurl = null;
	this.source_url = null;
}

WorkerWrapper.prototype.setTemporary = function(v) {
	if (typeof v == 'undefined') v = true;
	this.isTemp = v;
};

WorkerWrapper.prototype.load = function(urld) {
	var url = ((urld.protocol) ? urld.protocol + '://' : '') + urld.authority + urld.path;
	var this2 = this;

	// If no scheme was given, check our cache to see if we can save ourselves some trouble
	var full_url = url;
    if (!urld.protocol) {
        var scheme = _domainSchemes[urld.authority];
        if (!scheme) {
            scheme = _domainSchemes[urld.authority] = 'https://';
        }
        full_url = scheme + url;
    }

    // Try to fetch the script
	GET(full_url)
		.Accept('application/javascript, text/javascript, text/plain, */*')
		.fail(function(res) {
			if (!urld.protocol && res.status === 0) {
				// Domain error? Try again without ssl
                full_url = 'http://'+url;
                _domainSchemes[urld.authority] = 'http://'; // we know it isn't https at least
				return GET(full_url);
			}
			throw res;
		})
		.then(function(res) {
			this2.source_url = full_url;

			// Setup the bootstrap source to import scripts relative to the origin
			var bootstrap_src = require('../config.js').workerBootstrapScript;
			var hosturld = local.parseUri((urld.protocol != 'data') ? full_url : (window.location.protocol+'//'+window.location.hostname));
			var hostroot = hosturld.protocol + '://' + hosturld.authority;
			bootstrap_src = bootstrap_src.replace(/<HOST>/g, hostroot);
			bootstrap_src = bootstrap_src.replace(/<HOST_DIR_PATH>/g, (hosturld.directory||'').slice(0,-1));
			bootstrap_src = bootstrap_src.replace(/<HOST_DIR_URL>/g, hostroot + (hosturld.directory||'').slice(0,-1));

			// Create worker
			this2.script_blob = new Blob([bootstrap_src+'(function(){'+res.body+'})();'], { type: "text/javascript" });
			this2.script_objurl = window.URL.createObjectURL(this2.script_blob);
			this2.worker = new Worker(this2.script_objurl);
			this2.setup();
		})
		.fail(function(res) {
			this2.terminate(404, 'Worker Not Found');
		});
};

WorkerWrapper.prototype.setup = function() {
	var this2 = this;

	// Setup the incoming message handler
	this.worker.addEventListener('message', function(event) {
		var message = event.data;
		if (!message)
			return console.error('Invalid message from worker: Payload missing', this, event);

		// Handle messages with an `op` field as worker-control packets rather than HTTPL messages
		switch (message.op) {
			case 'ready':
				this2.isReady = true;
				_bridges[this2.id].flushBufferedMessages();
				break;
			case 'log':
				this2.onWorkerLog(message.body);
				break;
			case 'terminate':
				this2.terminate();
				break;
			default:
				// If no 'op' field is given, treat it as an HTTPL request and pass onto our bridge
				_bridges[this2.id].onMessage(message);
				break;
		}
	});

	// :TOOD: set terminate timeout for if no ready received
};

// Wrapper around the worker postMessage
WorkerWrapper.prototype.postMessage = function(msg) {
	if (this.worker) this.worker.postMessage(msg);
};

// Cleanup
WorkerWrapper.prototype.terminate = function(status, reason) {
	if (_bridges[this.id]) _bridges[this.id].terminate(status, reason);
	if (this.worker) this.worker.terminate();
	if (this.script_objurl) window.URL.revokeObjectURL(this.script_objurl);

	delete _bridges[this.id];
	this.worker = null;
	this.script_blob = null;
	this.script_objurl = null;
	this.isReady = false;
};

// Logs message data from the worker
WorkerWrapper.prototype.onWorkerLog = function(message) {
	if (!message)
		return;
	if (!Array.isArray(message))
		return console.error('Received invalid "log" operation: Payload must be an array', message);

	var type = message.shift();
	var args = ['['+this.source_url+']'].concat(message);
	switch (type) {
		case 'error':
			console.error.apply(console, args);
			break;
		case 'warn':
			console.warn.apply(console, args);
			break;
		default:
			console.log.apply(console, args);
			break;
	}
};