// Promise
// =======
// a value which can defer fulfillment; used for conditional async

if (typeof Promise == 'undefined') {
	(function() {
		globals.Promise = function Promise() {
			this.is_fulfilled = false;
			this.value = null;
			this.then_cbs = [];
		}

		// Runs any `then` callbacks with the given value
		Promise.prototype.fulfill = function Promise__fulfill(value) {
			if (this.is_fulfilled) { return; }
			this.is_fulfilled = true;
			// Store
			this.value = value;
			// Call thens
			for (var i=0; i < this.then_cbs.length; i++) {
				var cb = this.then_cbs[i];
				cb.func.call(cb.context, value);
			}
			this.then_cbs.length = 0;
		};

		// Adds a callback to be run when the promise is fulfilled
		Promise.prototype.then = function Promise__then(cb, opt_context) {
			if (!this.is_fulfilled) {
				// Queue for later
				this.then_cbs.push({ func:cb, context:opt_context });
			} else {
				// Call now
				cb.call(opt_context, this.value);
			}
			return this;
		};

		// Helper to register a then if the given value is a promise (or call immediately if it's another value)
		Promise.when = function when(value, cb, opt_context) {
			if (value instanceof Promise) {
				value.then(cb, opt_context);
			} else {
				cb.call(opt_context, value);
			}
		};

		// Helper to handle multiple promises in one when statement
		Promise.whenAll = function whenAll(values, cb, opt_context) {
			var p = Promise.combine(values);
			p.then(cb, opt_context);
			return p;
		};

		Promise.combine = function combine(values) {
			var p = new Promise();
			var total = values.length, fulfilled = 0;
			// if no length, presume an empty array and call back immediately
			if (!total) { p.fulfill([]); return; }
			// wait for all to finish
			for (var i=0; i < total; i++) {
				Promise.when(values[i], function(v) {
					values[this.i] = v; // replace with result
					if (++fulfilled == total) {
						p.fulfill(values);
					}
				}, { i:i });
			}
			return p;
		};

	})();
}