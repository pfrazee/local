// EventEmitter
// ============
// EXPORTED
// A minimal event emitter, based on the NodeJS api
// initial code borrowed from https://github.com/tmpvar/node-eventemitter (thanks tmpvar)
function EventEmitter() {
	Object.defineProperty(this, '_events', {
		value: {},
		configurable: false,
		enumerable: false,
		writable: true
	});

    Object.defineProperty(this, '_memoHistory', {
		value: null,
		configurable: false,
		enumerable: false,
		writable: true
	});
}
module.exports = EventEmitter;

EventEmitter.prototype.memoEventsTillNextTick = function() {
    this._memoHistory = {};
    require('./index.js').nextTick((function() {
        this._memoHistory = null;
    }).bind(this));
};

EventEmitter.prototype.emit = function(type) {
	var args = Array.prototype.slice.call(arguments);
    args = args.slice(1);

	var handlers = this._events[type];
	if (handlers) {
	    for (var i = 0, l = handlers.length; i < l; i++)
		    handlers[i].apply(this, args);
    }

    if (this._memoHistory) {
        if (!this._memoHistory[type]) { this._memoHistory[type] = []; }
        this._memoHistory[type].push(args);
    }

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

    if (this._memoHistory && this._memoHistory[type] && this._memoHistory[type].length) {
        for (var i = 0; i < this._memoHistory[type].length; i++) {
            listener.apply(this, this._memoHistory[type][i]);
        }
    }

	return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
	var self = this;
	self.on(type, function g() {
		self.removeListener(type, g);
		listener.apply(this, arguments);
	});

	return this;
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
	if (type) this._events[type] = null;
	else this._events = {};
	return this;
};

EventEmitter.prototype.clearEvents = function() {
	for (var type in this._events) {
		this.removeAllListeners(type);
	}
	return this;
};

EventEmitter.prototype.listeners = function(type) {
	return this._events[type];
};