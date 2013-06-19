// Events
// ======

// subscribe()
// ===========
// EXPORTED
// Establishes a connection and begins an event stream
// - sends a GET request with 'text/event-stream' as the Accept header
// - `request`: request object, formed as in `dispatch()`
// - returns a `EventStream` object
local.web.subscribe = function subscribe(request) {
	if (typeof request == 'string')
		request = { url: request };
	request.stream = true; // stream the response
	if (!request.method) request.method = 'GET';
	if (!request.headers) request.headers = { accept : 'text/event-stream' };
	if (!request.headers.accept) request.headers.accept = 'text/event-stream';

	var response_ = local.web.dispatch(request);
	return new EventStream(response_.request, response_);
};


// EventStream
// ===========
// EXPORTED
// provided by subscribe() to manage the events
function EventStream(request, response_) {
	local.util.EventEmitter.call(this);
	this.request = request;
	this.response = null;
	this.isConnOpen = true;

	this.connect(response_);
}
local.web.EventStream = EventStream;
EventStream.prototype = Object.create(local.util.EventEmitter.prototype);
EventStream.prototype.connect = function(response_) {
	var self = this;
	response_.then(
		function(response) {
			self.response = response;
			response.on('data', function(payload) {
				var events = payload.split("\r\n\r\n");
				events.forEach(function(event) {
					if (/^[\s]*$/.test(event)) return; // skip all whitespace
					emitEvent.call(self, event);
				});
			});
			response.on('end', function() { self.close(); });
			response.on('close', function() { if (this.isConnOpen) { self.reconnect(); } });
			// ^ a close event should be predicated by an end(), giving us time to close ourselves
			//   if we get a close from the other side without an end message, we assume connection fault
		},
		function(response) {
			self.response = response;
			emitError.call(self, { event: 'error', data: response });
			self.close();
		}
	);
};
EventStream.prototype.reconnect = function() {
	if (this.isConnOpen)
		this.close();
	this.connect(local.web.dispatch(this.request));
};
EventStream.prototype.close = function() {
	this.isConnOpen = false;
	this.request.close();
	this.emit('close');
};
function emitError(e) {
	this.emit('message', e);
	this.emit('error', e);
}
function emitEvent(e) {
	e = local.web.contentTypes.deserialize(e, 'text/event-stream');
	this.emit('message', e);
	this.emit(e.event, e);
}


// Broadcaster
// ===========
// EXPORTED
// a wrapper for event-streams
function Broadcaster() {
	this.streams = [];
}
local.web.Broadcaster = Broadcaster;

// listener management
Broadcaster.prototype.addStream = function(responseStream) {
	this.streams.push(responseStream);
	var self = this;
	responseStream.on('close', function() {
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
local.web.broadcaster = function() {
	return new Broadcaster();
};
