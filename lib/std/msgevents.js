// Message Events
// ==============
// wraps postMessage/onmessage with an events system

if (typeof postEventMsg == 'undefined') {
	(function() {
		var __event_handlers = {};

		self.postEventMsg = function postEventMsg(evt_name, data) {
			data = data || {};
			data.event = evt_name;
			self.postMessage(data);
		};

		self.addEventListener('message', function(message) {
			var event = message.data.event || 'message';
			if (__event_handlers[event]) {
				__event_handlers[event].forEach(function(handler) {
					handler.call(self, message.data);
				});
			}
		});

		self.addEventMsgListener = function addEventMsgListener(event, fn) {
			if (!__event_handlers[event]) { __event_handlers[event] = []; }
			__event_handlers[event].push(fn);
		}

		self.removeEventMsgListener = function removeEventMsgListener(event, target_fn) {
			var handlers = __event_handlers[event];
			if (!handlers) { return; }
			handlers.forEach(function(fn, i) {
				if (fn == target_fn) {
					__event_handlers[event].splice(i, 1);
				}
			});
		};

		self.removeAllEventMsgListeners = function removeAllEventMsgListeners(event) {
			if (__event_handlers[event]) {
				__event_handlers.length = 0;
			}
		};
	})();
}