define(function() {
    // Event Emitter
    // ==============
    // a function to mixing event behavior
    var EventEmitter = {
        mixin:EventEmitter__mixin
    };

    // adds event emitter properties and functions to the given object
    function EventEmitter__mixin(obj) {
        obj.addListener = EventEmitter__addListener;
        obj.removeListener = EventEmitter__removeListener;
        obj.removeAllListeners = EventEmitter__removeAllListeners;
        obj.emitEvent = EventEmitter__emitEvent;
    }

    // standard init check
    function EventEmitter__init() {
        if (!this.__evt_listeners) {
            this.__evt_listeners = {};
        }
    }

    // add cbs
    function EventEmitter__addListener(event, fn, opt_context) {
        EventEmitter__init.call(this);
        if (!(event in this.__evt_listeners)) { this.__evt_listeners[event] = []; }
        this.__evt_listeners[event].push({ fn:fn, context:opt_context });
        return this.__evt_listeners[event].length;
    }

    // remove cbs
    function EventEmitter__removeListener(event, fn) {
        EventEmitter__init.call(this);
        if (!(event in this.__evt_listeners)) { return false; }
        for (var i=0; i < this.__evt_listeners[event].length; i++) {
            if (this.__evt_listeners[event][i].fn == fn) {
                this.__evt_listeners[event].splice(i, 1);
                return true;
            }
        }
        return false;
    }

    // remove all cbs
    function EventEmitter__removeAllListeners(event) {
        EventEmitter__init.call(this);
        if (!(event in this.__evt_listeners)) { return false; }
        this.__evt_listeners[event].length = 0;
    }

    // send event to listeners
    function EventEmitter__emitEvent(event) {
        var args = Array.prototype.slice.call(arguments, 1);
        if (!(event in this.__evt_listeners)) { return; }
        this.__evt_listeners[event].forEach(function(l) {
            l.fn.apply(l.context, args);
        });
    }
    
    return EventEmitter;
});
