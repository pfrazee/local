// HTTP
// ====
// provides Http.Router and Http.* functions

if (typeof Http == 'undefined') {
	(function() {
		globals.Http = {
			Router:Router,
			route:Http__route,
			response:Http__response,
			reflectLinks:reflectLinks,
			parseUri:parseUri
		};

		// Router
		// ======
		function Router() {
			this.servers = [];
			this.cur_mid = 1;
			this.ajax_config = {
				proxy:null,
				proxy_query_header:'x-proxy-query'
			};
		}

		// Configures the server into the uri structure
		//  - maintains precedence in ordering according to the URI
		//    '#/a' is before '#/a/b' is before '#/a/b/c'
		//  - a duplicate URI is inserted after existing servers
		Router.prototype.addServer = function Router__addServer(new_uri, server) {
			var new_uri_slashes_count = new_uri.split('/').length;
			for (var i=0; i < this.servers.length; i++) {
				// Lower URI? done
				var existing_uri = this.servers[i].uri;
				if ((existing_uri.indexOf(new_uri) === 0) && (new_uri_slashes_count < existing_uri.split('/').length)) {
					break;
				}
			}
			this.servers.splice(i, 0, { uri:new_uri, inst:server });
		};

		// Removes all matching servers from the structure
		//  - non-regexp `uri` must be an exact match
		Router.prototype.removeServers = function Router__removeServers(uri) {
			var isregex = (uri instanceof RegExp);
			var test = isregex ? uri.test : function(v) { return this == v; };
			this.servers.forEach(function(m, i) {
				if (test.call(uri, m.uri)) {
					this.servers.splice(i, 1);
				}
			}, this);
		};

		// Searches servers for handlers for the given request
		//  - returns an array of objects with the keys { cb, server, match, route }
		//  - returns the handlers in the order of server precedence
		function Router__findHandlers(request) {
			var matched_handlers = [];
			this.servers.forEach(function(server) {
				var rel_uri_index = request.uri.indexOf(server.uri);
				if (rel_uri_index === 0) {

					// is it a complete name match? (/foo matches /foo/bar, not /foobar)
					var rel_uri = request.uri.substr(server.uri.length);
					/*if (rel_uri != '' && rel_uri.charAt(0) != '/') { //:TODO: better way to check this
						return [];
					}*/
					if (rel_uri.charAt(0) != '/') { rel_uri = '/' + rel_uri; } // prepend the leading slash, for consistency

					for (var j=0; j < server.inst.routes.length; j++) {
						var route = server.inst.routes[j];
						var match, matches = {};
						for (var k in route.match) {
							match = true;

							if (!(k in request)) {
								Util.log('routing', ' > ',/*server.inst,*/route.cb,'MISS ('+k+')');
								match = false;
								break;
							}

							// convert strings to regexps
							if (typeof(route.match[k]) == 'string') { route.match[k] = new RegExp(route.match[k], 'i'); }

							// test for match
							var reqVal = (k == 'uri' ? rel_uri : request[k]);
							if (route.match[k] instanceof RegExp) {
								match = route.match[k].exec(reqVal);
								if (!match) {
									Util.log('routing', ' > ',/*server.inst,*/route.cb,'MISS ('+k+' "'+reqVal+'")');
									break;
								}
								matches[k] = match;
							}
							else {
								if (route.match[k] != reqVal) {
									Util.log('routing', ' > ',/*server.inst,*/route.cb,'MISS ('+k+' "'+reqVal+'")');
									match = false; break;
								}
								matches[k] = reqVal;
							}
						}
						if (!match) { continue; }

						Util.log('routing', ' > ',/*server.inst,*/route.cb,'MATCH');
						var cb = server.inst[route.cb];
						if (!cb) {
							Util.log('errors', "Handler callback '" + route.cb + "' not found in object");
							continue;
						}
						matched_handlers.push({
							cb:cb,
							context:server.inst,
							match:matches,
							capture:route.capture
						});
					}
				}
			}, this);
			return matched_handlers;
		}

		// (ASYNC) Builds the handler chain from the request, then runs
		//  - When finished, calls the given cb with the response
		//  - If the request target URI does not start with a hash, will run the remote handler
		Router.prototype.dispatch = function Router__dispatch(request, opt_cb, opt_context) {
			request = Util.deepCopy(request);
			Object.defineProperty(request, '__mid', { value:this.cur_mid++ });

			var dispatch_promise = new Promise();
			if (opt_cb) { dispatch_promise.then(opt_cb, opt_context); }
			Object.defineProperty(request, '__dispatch_promise', { value:dispatch_promise });

			__processQueryParams(request);

			Util.log('traffic', '|>', request.org+':', request.__mid, request.method, request.uri, request);

			// URIs that dont target hash URIs should be fetched remotely
			var protocol = request.uri.split('://');
			if (protocol.length == 2 && protocol[0] != 'lsh') {
				__dispatchRemote.call(this, request);
				return dispatch_promise;
			}

			var handlers = Router__findHandlers.call(this, request);
			Object.defineProperty(request, '__bubble_handlers', { value:[], writable:true });
			Object.defineProperty(request, '__capture_handlers', { value:[], writable:true });
			for (var i=0; i < handlers.length; i++) {
				if (handlers[i].capture) {
					request.__capture_handlers.push(handlers[i]);
				} else {
					request.__bubble_handlers.push(handlers[i]);
				}
			}

			var self = this;
			setTimeout(function() { Router__runHandlers.call(self, request); }, 0);
			return dispatch_promise;
		};

		function Router__runHandlers(request) {
			var handler = request.__capture_handlers.shift();
			if (!handler) { handler = request.__bubble_handlers.shift(); }
			if (!handler) { return Router__finishHandling.call(this, request, null); }

			var promise = handler.cb.call(handler.context, request, handler.match);
			Promise.when(promise, function(response) {
				if (response) {
					Router__finishHandling.call(this, request, response);
				} else {
					Router__runHandlers.call(this, request);
				}
			}, this);
		}

		function Router__finishHandling(request, response) {
			if (!response) {
				response = Http.response(404, 'Not Found', 'text/plain');
			}
			Util.log('traffic', ' >|', request.org+':', request.__mid, response.code, response.reason, response);

			response.body = ContentTypes.deserialize(response.body, response['content-type']);

			request.__dispatch_promise.fulfill(response);
		}

		// Pulls the query params into the request.query object
		function __processQueryParams(request) {
			request.query = request.query || {};
			if (request.uri && request.uri.indexOf('?') != -1) {
				// pull uri out
				var parts = request.uri.split('?');
				request.uri = parts.shift();
				// iterate the values
				parts = parts.join('').split('&');
				for (var i=0; i < parts.length; i++) {
					if (!parts[i]) { continue; }
					var kv = parts[i].split('=');
					var k = kv[0], v = kv[1];
					if (v.charAt(0) == '"') { v = /"(.*)"/.exec(v)[1]; }
					else if (v.charAt(0) == "'") { v = /'(.*)'/.exec(v)[1]; }
					if (k in request.query) {
						if (Array.isArray(request.query[k])) {
							request.query[k].push(v);
						} else {
							request.query[k] = [v];
						}
					} else {
						request.query[k] = v;
					}
				}
			}
		}

		Router.prototype.ajaxConfig = function ajaxConfig(k, v) {
			if (typeof v == "undefined") { return this.ajax_config[k]; }
			this.ajax_config[k] = v;
			return v;
		};

		function __dispatchRemote(request) {
			if (typeof window != 'undefined') {
				return __sendAjaxRequest.call(this, request);
			} else {
				request.__dispatch_promise.fulfill(Http.response([418,'teapots dont ajax'], 'Agents can not route to remote resources', 'text/plain'));
			}
		}
		function __sendAjaxRequest(request) {
			var xhrRequest = new XMLHttpRequest();
			var target_uri = request.uri;

			var k;
			var query = '';
			if (request.query) {
				var q = [];
				for (k in request.query) {
					q.push(k+'='+request.query[k]);
				}
				if (q.length) {
					query = '?' + q.join('&');
				}
				delete request.query;
			}

			if (this.ajax_config.proxy && /:\/\//.test(target_uri)) { // only use proxy if a protocol-qualified URL
				request[this.ajax_config.proxy_query_header] = query;
				target_uri = this.ajax_config.proxy + '?url=' + request.uri;
			} else {
				target_uri += query;
			}

			request.body = ContentTypes.serialize(request.body, request['content-type']);
			xhrRequest.open(request.method, target_uri, true);
			for (k in request) {
				if (k == 'method' || k == 'uri' || k == 'body') { continue; }
				xhrRequest.setRequestHeader(k, request[k]);
			}

			xhrRequest.onreadystatechange = function() {
				if (xhrRequest.readyState == 4) {
					var response = {};
					// :NOTE: a bug in firefox causes getAllResponseHeaders to return an empty string on CORS
					// we either need to bug them, or iterate the headers we care about with getResponseHeader
					xhrRequest.getAllResponseHeaders().split("\n").forEach(function(h) {
						if (!h) { return; }
						var kv = h.toLowerCase().replace('\r','').split(': ');
						response[kv[0]] = kv[1];
					});

					response.code = xhrRequest.status;
					response.reason = xhrRequest.statusText;
					response.body = ContentTypes.deserialize(xhrRequest.responseText, response['content-type']);

					Util.log('traffic', ' >|', request.org+':', request.__mid, response.code, response.reason, response);
					request.__dispatch_promise.fulfill(response);
				}
			};
			xhrRequest.send(request.body);
		}

		// Maker Functions
		// ===============
		function Http__route(cb, match, capture_phase) {
			return { cb:cb, match:match, capture:capture_phase };
		}
		function Http__response(code, body, contenttype, headers) {
			var response = headers || {};
			if (Array.isArray(code)) {
				response.code = code[0];
				response.reason = code[1];
			} else {
				response.code = code;
			}
			if (body) { response.body = body; }
			if (contenttype) { response['content-type'] = contenttype; }
			return response;
		}
		Http__response.unauthorized = function(challenge) {
			return Http.response([401,'unauthorized'], null, null, { 'www-authenticate':challenge });
		};
		Http__response.badperms = function(perms, prompt) {
			perms = perms || [];
			var res = Http.response.unauthorized({
				scheme:'LSHSession',
				perms:(Array.isArray(perms)) ? perms : [perms],
				prompt:prompt
			});
			return res;
		};

		// Link Reflector
		// ==============
		function reflectLinks(links, static_params) {
			if (!Array.isArray(links)) { links = [links]; }
			var fns = {};
			links.forEach(function(link) {
				var methods = Array.isArray(link.methods) ? link.methods : [link.method];
				if (methods.length == 0) { methods = ['get']; }
				methods.forEach(function(method) {
					var fn_name = method+link.title;
					fn_name = fn_name.replace(/ /g, '_');
					fns[fn_name] = reflectLinks__makeFunc(method, link, static_params);
				})
			});
			return fns;
		}
		// moved here to reduce closure size
		function reflectLinks__makeFunc(method, link, static_params) {
			return function(params, opt_body, opt_type, opt_headers, opt_follow) {
				var request = opt_headers || {};
				if (opt_body) { request.body = opt_body; }
				if (opt_type) { request['content-type'] = opt_type; }

				params = params || {};
				for (var k in static_params) {
					if (!(k in params)) {
						params[k] = static_params[k];
					}
				}

				var href_parts = link.href.split('?');
				var uri = href_parts[0]; 
				var query = href_parts[1];
				for (var k in params) {
					uri = uri.replace('{'+k+'}', params[k]);
					if (query) {
						query = query.replace('{'+k+'}', k+'="'+params[k]+'"');
					}
				}
				request.uri = uri.replace(/\{.*\}/g, '');
				if (query) {
					query = query
						.replace(/\{[A-z0-9]*\}/g, '') // empty {}s
						.replace(/&+/g,'&') // repeating &s
						.replace(/^&/,'') // & at beginning
						.replace(/&$/,''); // & at end
					request.uri += '?' + query;
				}

				if (!request.method) {
					request.method = method;
				}
				if (!request.accept && link.type) {
					request.accept = link.type;
				}

				return Agent.dispatch(request, opt_follow);
			};
		}

		// parseUri 1.2.2
		// ==============
		// (c) Steven Levithan <stevenlevithan.com>
		// MIT License

		function parseUri (str) {
			var	o   = parseUri.options,
				m   = o.parser[o.strictMode ? "strict" : "loose"].exec(str),
				uri = {},
				i   = 14;

			while (i--) uri[o.key[i]] = m[i] || "";

			uri[o.q.name] = {};
			uri[o.key[12]].replace(o.q.parser, function ($0, $1, $2) {
				if ($1) uri[o.q.name][$1] = $2;
			});

			return uri;
		}

		parseUri.options = {
			strictMode: false,
			key: ["source","protocol","authority","userInfo","user","password","host","port","relative","path","directory","file","query","anchor"],
			q:   {
				name:   "queryKey",
				parser: /(?:^|&)([^&=]*)=?([^&]*)/g
			},
			parser: {
				strict: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,
				loose:  /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/
			}
		};
	})();
}
