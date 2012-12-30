// Resource
// ========
// extends linkjs
// pfraze 2012

(function (exports) {

	// helper to construct resource prototypes
	function extend(origin, target) {
		if (origin) {
			if (typeof target != 'object') { target = {}; }
			for (var k in origin) {
				if (typeof origin[k] == 'object') {
					target[k] = extend(origin[j], target[k]);
				} else {
					target[k] = origin[k];
				}
			}
		}
		return target;
	}

	// helper to pull values out of wrapper functions
	function generate(v) {
		return (typeof v == 'function') ? v() : v;
	}

	// helper for searching for Accept and Content-Type handlers
	function findTypeConverter(targetType, converters) {
		if (!targetType) { return null; }
		for (var converterType in converters) {
			// look for a partial match
			if (targetType.indexOf(converterType) !== -1) { return converters[converterType]; }
		}
	}

	// resource type behaviors
	var rezTypeBehaviors = {
		'item':{
			// resource methods
			construct:function(init, options) {
				this.values = {};
				if (options) {
					this.collection = options.collection || null;
				}
				this.__put(null, init);
			},
			buildHeaders:function(request, output) {
				var headers = {};
				if (request.headers.accept) {
					headers['content-type'] = request.headers.accept;
				}
				// :TODO: links
				// :TODO: what else?
				return headers;
			},

			// message handlers
			__get:function() {
				return this.values;
			},
			__patch:function(request, values) {
				// copy in values
				var changes = [];
				for (var k in this.model.attributes) {
					if (values[k]) {
						this.values[k] = values[k];
						changes.push(k);
					}
				}
				this.broadcast(changes);
				if (this.collection) { this.collection.broadcast(changes); }
			},
			__put:function(request, values) {
				// build the values, throwing an exception if the initial values are invalid
				for (var k in this.model.attributes) {
					var attr = this.model.attributes[k];
					var value = generate(attr.value || values[k] || attr.fallback);
					if (!value) {
						if (attr.required) { throw "initial value required for `"+k+"`"; }
					} else {
						this.values[k] = value;
					}
				}
				this.broadcast();
				if (this.collection) { this.collection.broadcast(); }
			},
			__delete:function() {
				if (this.collection) { this.collection.removeItem(this); }
				this.broadcast();
				if (this.collection) { this.collection.broadcast(); }
				this.collection = null;
			}
		},
		'collection':{
			// resource methods
			construct:function(init) {
				this.items = [];

				// pull in data from the model
				this.ItemConstructor = this.model.of;

				// create initial collection
				if (init) {
					if (Array.isArray(init) === false) {
						throw "initial value for the collection resource must be an array";
					}
					init.forEach(this.addItem, this);
				}
			},
			select:function(path) {
				if (!path || !path.length || !path[0]) { return this; }
				var id = path.unshift();
				// find the item with the matching id
				var index = this.indexOf(id);
				if (index !== -1) {
					// continue selecting
					return this.items[index].select(path);
				}
				return null;
			},
			buildHeaders:function(request, output) {
				var headers = {};
				if (request.headers.accept) {
					headers['content-type'] = request.headers.accept;
				}
				// :TODO: links
				// :TODO: what else?
				return headers;
			},
			getInputConverter:function(request) {
				var type = request.headers['content-type'];
				// when creating, get from the item type
				if (request.method == 'post') {
					return findTypeConverter.call(this, type, this.ItemConstructor.model.from);
				}
				return findTypeConverter.call(this, type, this.model.from);
			},

			// collection methods
			addItem:function(v) {
				var item = new (this.ItemConstructor)(v, { collection:this });
				this.items.push(item);
				return item;
			},
			indexOf:function(id) {
				for (var i=0, ii=this.items.length; i < ii; i++) {
					if (this.items[i].values.id === id) {
						return i;
					}
				}
				return -1;
			},
			removeItem:function(v) {
				var index = this.indexOf(v.values.id);
				if (index === -1) { return false; }
				this.items.splice(index, 1);
				return true;
			},

			// message handlers
			__get:function(request) {
				return this.filter(request.query, this.items);
			},
			__post:function(request, values) {
				this.addItem(values);
				this.broadcast();
			},
			__delete:function() {
				// :TODO: use query filters here? would need to change how filters are defined
				this.items.length = 0;
				this.broadcast();
			}
		},
		'service':{
			// resource methods
			construct:function(init) {
				// :TODO:
			},
			select:function() {
				// :TODO:
			},
			buildHeaders:function(request, output) {
				var headers = {};
				if (request.headers.accept) {
					headers['content-type'] = request.headers.accept;
				}
				// :TODO: links
				// :TODO: what else?
				return headers;
			},

			// message handlers
			__get:function() {
				// :TODO:
			}
		}
	};

	// generates the text/event-stream 
	function eventsOutputBuilder(request, output) {
		return this.broadcaster;
	}

	// resource	
	// ========
	// produces a simple request/response machine for RESTful servers
	function resource(model) {
		if (!model.type) { throw "`type` must be specified in the resource model"; }

		// create the prototype according to the model
		function Resource(init) {
			model.methods  = model.methods  || [];
			model.handlers = model.handlers || {};
			model.filters  = model.filters  || {};
			model.from     = model.from     || {};
			model.as       = model.as       || {};

			this.model = model;

			// setup event broadcasting
			if (this.model.broadcast) {
				this.broadcaster = Link.broadcaster();
				if (!this.model.as['text/event-stream']) {
					// add the event-stream builder, if not given by the model
					this.model.as['text/event-stream'] = eventsOutputBuilder;
				}
			}

			if (typeof this.construct == 'function') {
				this.construct(init);
			}
		}
		Resource.model = model;

		// finds a resource according to a path
		// - path was a relative url path, now broken into chunks separated by '/'
		// - should be overridden by types
		Resource.prototype.select = function(path) {
			// return this only if at the end of the path
			if (!path || !path.length || !path[0]) { return this; }
			// otherwise, dont know what to do because resource type isnt defined
			return null;
		};

		// filters `arr` according to the resource model and the values given in `query`
		Resource.prototype.filter = function(query, arr) {
			for (var k in query) {
				var modelFilter = this.model.filters[k];
				if (!modelFilter) { continue; }
				arr = modelFilter(arr, query[k]);
			}
			return arr;
		};

		// broadcasts an update event to subscribers
		// - `keys` is an optional list of changed values
		Resource.prototype.broadcast = function(keys) {
			if (this.model.broadcast) {
				if (keys && !Array.isArray(keys)) { keys = [keys]; }
				this.broadcaster.emit('update', keys);
			}
		};

		// can the resource do the requested method?
		Resource.prototype.canDo = function(request) {
			return (this.model.methods.indexOf(request.method) !== -1);
		};

		// fetches the converter for the given input type
		Resource.prototype.getInputConverter = function(request) {
			return findTypeConverter.call(this, request.headers['content-type'], this.model.from);
		};

		// fetches the representation builder for the requested output type
		Resource.prototype.getOutputBuilder = function(request) {
			return findTypeConverter.call(this, request.headers.accept, this.model.as);
		};

		// builds headers for the response
		// - should be overridden by types
		Resource.prototype.buildHeaders = function(request, output) {
			return {};
		};

		// extend resource behaviors according to type
		var rezType = rezTypeBehaviors[model.type];
		extend(rezType, Resource.prototype);

		// request handler
		Resource.prototype.route = function(request, response) {
			var respond = Link.responder(response);

			// request fallbacks
			request.headers = request.headers || {};
			request.headers.accept = request.headers.accept || this.model.defaultType;

			// find the target resource
			var rez = this.select(request.path.split('/'));
			if (!rez) {
				respond.notFound().end();
				return;
			}

			// check method support
			if (!rez.canDo(request)) {
				respond.methodNotAllowed().end();
				return;
			}

			// check content-type support
			var inputType = request.headers['content-type'];
			var convertInput = rez.getInputConverter(request);
			if (inputType && !convertInput) {
				respond.unsupportedMediaType().end();
				return;
			}

			// check accept support
			var acceptType = request.headers.accept;
			var buildOutput = rez.getOutputBuilder(request);
			if (acceptType && !buildOutput) {
				respond.notAcceptable().end();
				return;				
			}

			// convert input to the internal representation
			var values;
			if (convertInput && request.body) {
				values = convertInput.call(rez, request, request.body);
			}

			// execute resource behavior
			var handler = rez.model.handlers[request.method] || rez['__'+request.method];
			if (!handler) {
				respond.notImplemented().end();
				return;
			}
			var output = handler.call(rez, request, values);

			// retreive headers
			var headers = rez.buildHeaders(request, output);

			// convert output to requested representation
			if (output) {
				output = buildOutput.call(rez, request, output);
			}

			// respond according to output type
			if (output instanceof Link.Broadcaster) {
				respond.ok('text/event-stream');
				output.addStream(response);
			} else {
				respond.ok(acceptType, headers).end(output);
			}
		};

		return Resource;
	}

	exports.resource = resource;
})(Link);