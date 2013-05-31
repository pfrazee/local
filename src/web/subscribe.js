// Events
// ======

// the directory of the environment context
var __windowLocationDirname = (typeof window != 'undefined') ? window.location.pathname.split('/') : [''];
__windowLocationDirname[__windowLocationDirname.length - 1] = '';
__windowLocationDirname = __windowLocationDirname.join('/');

// subscribe()
// ===========
// EXPORTED
// Establishes a connection and begins an event stream
// - sends a GET request with 'text/event-stream' as the Accept header
// - `req` param:
//   - requires the target url
//   - target url can be passed in req as `url`, or generated from `host` and `path`
// - returns a `EventStream` object
local.http.subscribe = function subscribe(req) {

	if (!req) { throw "no options provided to subscribe"; }
	if (typeof req == 'string') {
		req = { url:req };
	}

	// parse the url
	// (urld = url description)
	if (!req.url)
		req.url = local.http.joinUrl(req.host, req.path);
	req.urld = local.http.parseUri(req.url);
	if (!req.urld)
		throw "no URL or host/path provided in request";

	// prepend host on relative path
	if (!req.urld.protocol) {
		if (req.url.length > 0 && req.url.charAt(0) != '/') {
			// relative to current dirname
			req.url = window.location.protocol + "//" + window.location.host + __windowLocationDirname + req.url;
		} else {
			// relative to current hose
			req.url = window.location.protocol + "//" + window.location.host + req.url;
		}
		req.urld = local.http.parseUri(req.url);
	}

	// execute according to protocol
	if (req.urld.protocol == 'httpl')
		return __subscribeLocal(req);
	else
		return __subscribeRemote(req);
};

// subscribes to a local host
function __subscribeLocal(req) {

	// initiate the event stream
	var stream = new LocalEventStream(local.http.dispatch({
		method  : 'get',
		url     : 'httpl://' + req.urld.authority + req.urld.relative,
		headers : { accept : 'text/event-stream' },
		stream  : true
	}));
	return stream;
}

// subscribes to a remote host
function __subscribeRemote(req) {
	if (typeof window != 'undefined')
		return __subscribeRemoteBrowser(req);
	else
		return __subscribeRemoteNodejs(req);
}

// subscribes to a remote host in the browser
function __subscribeRemoteBrowser(req) {

	// assemble the final url
	var url = (req.urld.protocol || 'http') + '://' + req.urld.authority + req.urld.relative;

	// initiate the event stream
	return new BrowserRemoteEventStream(url);
}

// subscribes to a remote host in a nodejs process
function __subscribeRemoteNodejs(req) {
	throw "subscribe() has not yet been implemented for nodejs";
}

// EXPORTED
// allows the API consumer to handle subscribes with their own code
// - mainly for workers to submit subscribes to the document for routing
local.http.setEventSubscriber = function setEventSubscriber(fn) {
	__customEventSubscriber = fn;
};

// EventStream
// ===========
// EXPORTED
// provided by subscribe() to manage the events
function EventStream() {
	local.util.EventEmitter.call(this);
	this.isConnOpen = true;
}
local.http.EventStream = EventStream;
EventStream.prototype = Object.create(local.util.EventEmitter.prototype);
EventStream.prototype.close = function() {
	this.isConnOpen = false;
	this.emit('close');
	this.removeAllListeners();
};
EventStream.prototype.__emitError = function(e) {
	this.emit('message', e);
	this.emit('error', e);
};
EventStream.prototype.__emitEvent = function(e) {
	this.emit('message', e);
	this.emit(e.event, e);
};

// LocalEventStream
// ================
// INTERNAL
// descendent of EventStream
function LocalEventStream(resPromise) {
	EventStream.call(this);
	this.response = null;

	// wait for the promise
	var self = this;
	resPromise.then(
		function(response) {
			self.response = response;
			response.on('data', function(payload) {
				self.__emitEvent(payload);
			});
			response.on('end', function() {
				self.close();
			});
		},
		function(response) {
			self.__emitError({ event:'error', data:response });
			self.close();
		}
	);
}
local.http.LocalEventStream = LocalEventStream;
LocalEventStream.prototype = Object.create(EventStream.prototype);
LocalEventStream.prototype.close = function() {
	this.__emitError({ event:'error', data:undefined }); // :NOTE: emulating the behavior of EventSource
	// :TODO: would be great if close didn't emit the above error
	EventStream.prototype.close.call(this);
	if (this.response)
		this.response.close();
	this.response = null;
};

// BrowserRemoteEventStream
// ========================
// INTERNAL
// descendent of EventStream, abstracts over EventSource
function BrowserRemoteEventStream(url) {
	EventStream.call(this);

	// establish the connection to the remote source
	this.eventSource = new EventSource(url);
	// wire it up to our functions
	var self = this;
	this.eventSource.onerror = function(e) {
		if (e.target.readyState == EventSource.CLOSED)
			self.close();
	};
}
local.http.BrowserRemoteEventStream = BrowserRemoteEventStream;
BrowserRemoteEventStream.prototype = Object.create(EventStream.prototype);
BrowserRemoteEventStream.prototype.addListener = function(type, listener) {
	if (Array.isArray(type)) {
		type.forEach(function(t) { this.addListener(t, listener); }, this);
		return;
	}
	if (!this._events[type]) {
		// if this is the first add to the event stream, register our interest with the event source
		var self = this;
		this.eventSource.addEventListener(type, function(e) {
			var data = e.data;
			try { data = JSON.parse(data); } catch(err) {}
			self.__emitEvent({ event:e.type, data:data });
		});
	}
	local.util.EventEmitter.prototype.addListener.call(this, type, listener);
};
BrowserRemoteEventStream.prototype.on = BrowserRemoteEventStream.prototype.addListener;
BrowserRemoteEventStream.prototype.close = function() {
	this.eventSource.close();
	this.eventSource.onerror = null;
	this.eventSource = null;
	EventStream.prototype.close.call(this);
};

// Broadcaster
// ===========
// EXPORTED
// a wrapper for event-streams
function Broadcaster() {
	this.streams = [];
}
local.http.Broadcaster = Broadcaster;

// listener management
Broadcaster.prototype.addStream = function(responseStream) {
	this.streams.push(responseStream);
	var self = this;
	responseStream.clientResponse.on('close', function() {
		self.endStream(responseStream);
	});
};
Broadcaster.prototype.endStream = function(responseStream) {
	this.streams = this.streams.filter(function(rS) { return rS != responseStream; });
	responseStream.end();
};
Broadcaster.prototype.endAllStreams = function() {
	this.streams.forEach(function(rS) { rS.end(); });
	this.streams.length = 0;
};

// sends an event to all streams
Broadcaster.prototype.emit = function(eventName, data) {
	this.streams.forEach(function(rS) { this.emitTo(rS, eventName, data); }, this);
};

// sends an event to the given response stream
Broadcaster.prototype.emitTo = function(responseStream, eventName, data) {
	responseStream.write({ event:eventName, data:data });
};

// wrap helper
local.http.broadcaster = function() {
	return new Broadcaster();
};