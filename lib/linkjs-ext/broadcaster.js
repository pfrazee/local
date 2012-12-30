// Broadcaster
// ===========
// extends linkjs
// pfraze 2012

(function (exports) {
	
	// Broadcaster
	// ===========
	// a wrapper for event-streams
	// - `response` should be a `ServerResponse` object (given as the `response` param of the server's request handler fn)
	function Broadcaster() {
		this.streams = [];
	}

	// listener management
	Broadcaster.prototype.addStream = function(responseStream) {
		this.streams.push(responseStream);
		// :TODO listen for close?
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
	function broadcaster() {
		return new Broadcaster();
	}

	exports.Broadcaster = Broadcaster;
	exports.broadcaster = broadcaster;
})(Link);