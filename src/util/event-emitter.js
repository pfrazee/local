// EventEmitter
// ============
// EXPORTED
// A minimal event emitter, based on the NodeJS api
// initial code borrowed from https://github.com/tmpvar/node-eventemitter (thanks tmpvar)
function EventEmitter() {
	Object.defineProperty(this, '_events', {
		value: {},
		configurable: true,
		enumerable: false
	});
	Object.defineProperty(this, '_history', {
		value: {},
		configurable: true,
		enumerable: false
	});
}

EventEmitter.prototype.keepHistory = function(type) {
	if (!this._history[type])
		this._history[type] = [];
};

EventEmitter.prototype.loseHistory = function(type) {
	if (this._history[type])
		delete this._history[type];
};

EventEmitter.prototype.emit = function(type) {
	var args = Array.prototype.slice.call(arguments, 1);

	if (this._history[type])
		this._history[type].push(args);

	var handlers = this._events[type];
	if (!handlers) return false;

	for (var i = 0, l = handlers.length; i < l; i++)
		handlers[i].apply(this, args);

	return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
	if (Array.isArray(type)) {
		type.forEach(function(t) { this.addListener(t, listener); }, this);
		return;
	}

	if ('function' !== typeof listener) {
		throw new Error('addListener only takes instances of Function');
	}

	// To avoid recursion in the case that type == "newListeners"! Before
	// adding it to the listeners, first emit "newListeners".
	this.emit('newListener', type, listener);

	if (!this._events[type]) {
		this._events[type] = [listener];
	} else {
		this._events[type].push(listener);
	}

	// play back history, if we have any
	var self = this;
	if (this._history[type] && this._history[type].length)
		this._history[type].forEach(function(args) { listener.apply(self, args); });

	return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
	var self = this;
	self.on(type, function g() {
		self.removeListener(type, g);
		listener.apply(this, arguments);
	});
};

EventEmitter.prototype.removeListener = function(type, listener) {
	if ('function' !== typeof listener) {
		throw new Error('removeListener only takes instances of Function');
	}
	if (!this._events[type]) return this;

	var list = this._events[type];
	var i = list.indexOf(listener);
	if (i < 0) return this;
	list.splice(i, 1);
	if (list.length === 0) {
		delete this._events[type];
	}

	return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
	if (type && this._events[type]) this._events[type] = null;
	if (this._history[type]) this._history[type] = null;
	return this;
};

EventEmitter.prototype.listeners = function(type) {
	return this._events[type];
};

local.util.EventEmitter = EventEmitter;