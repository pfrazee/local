// HTTP Router
// ===========
// routes http messages to js handler functions

if (typeof HttpRouter == 'undefined') {
    (function() {
        globals.HttpRouter = function HttpRouter() {
            this.modules = [];
            this.response_cbs = [];
            this.cur_mid = 1;
            this.ajax_config = {
                proxy:null,
                proxy_query_header:'x-proxy-query'
            };
        }

        // Configures the module into the uri structure
        //  - maintains precedence in ordering according to the URI
        //    '#/a' is before '#/a/b' is before '#/a/b/c'
        //  - a duplicate URI is inserted after existing modules
        HttpRouter.prototype.addModule = function HttpRouter__addModule(new_uri, module) {
            var new_uri_slashes = new_uri.split('/').length;
            for (var i=0; i < this.modules.length; i++) {
                // Lower URI? done
                var existing_uri = this.modules[i].uri;
                if ((existing_uri.indexOf(new_uri) == 0) && (new_uri_slashes < existing_uri.split('/').length)) {
                    break;
                }
            }
            this.modules.splice(i, 0, { uri:new_uri, inst:module });
        };

        // Removes all matching modules from the structure
        //  - non-regexp `uri` must be an exact match
        HttpRouter.prototype.removeModules = function HttpRouter__removeModules(uri) {
            var isregex = (uri instanceof RegExp);
            var test = isregex ? uri.test : function(v) { return this == v; };
            this.modules.forEach(function(m, i) {
                if (test.call(uri, m.uri)) {
                    this.modules.splice(i, 1);
                }
            }, this);
        };

        // Searches modules for handlers for the given request
        //  - returns an array of objects with the keys { cb, module, match, route }
        //  - returns the handlers in the order of module precedence
        function HttpRouter__findHandlers(request) {
            var matched_handlers = [];
            this.modules.forEach(function(module) {
                var rel_uri_index = request.uri.indexOf(module.uri);
                if (rel_uri_index == 0) {

                    // is it a complete name match? (/foo matches /foo/bar, not /foobar)
                    var rel_uri = request.uri.substr(module.uri.length);
                    if (!(rel_uri == '' || rel_uri.charAt(0) == '/')) {
                        return;
                    }
                    if (rel_uri.charAt(0) != '/') { rel_uri = '/' + rel_uri; } // prepend the leading slash, for consistency

                    for (var j=0; j < module.inst.routes.length; j++) {
                        var route = module.inst.routes[j];
                        var match, matches = {};
                        for (var k in route.match) {
                            match = true;

                            if (!(k in request)) {
                                Util.log('routing', ' > ',module.inst,route.cb,'MISS ('+k+')');
                                match = false;
                                break;
                            }

                            // convert strings to regexps
                            if (typeof(route.match[k]) == 'string') { route.match[k] = new RegExp(route.match[k], 'i'); }

                            // test for match
                            var reqVal = (k == 'uri' ? rel_uri : request[k]);
                            if (route.match[k] instanceof RegExp) {
                                match = route.match[k].exec(reqVal)
                                if (!match) { 
                                    Util.log('routing', ' > ',module.inst,route.cb,'MISS ('+k+' "'+reqVal+'")');
                                    break; 
                                }
                                matches[k] = match;
                            }
                            else {
                                if (route.match[k] != reqVal) { 
                                    Util.log('routing', ' > ',module.inst,route.cb,'MISS ('+k+' "'+reqVal+'")');
                                    match = false; break; 
                                }
                                matches[k] = reqVal;
                            }
                        }
                        if (!match) { continue; }

                        Util.log('routing', ' > ',module.inst,route.cb,'MATCH');
                        var cb = module.inst[route.cb];
                        if (!cb) {
                            console.log("Handler callback '" + route.cb + "' not found in object");
                            continue;
                        }
                        matched_handlers.push({
                            cb:cb,
                            context:module.inst,
                            match:matches,
                            bubble:route.bubble
                        });
                    }
                }
            }, this);
            return matched_handlers;
        }

        // (ASYNC) Builds the handler chain from the request, then runs
        //  - When finished, calls the given cb with the response
        //  - If the request target URI does not start with a hash, will run the remote handler
        HttpRouter.prototype.dispatch = function HttpRouter__dispatch(request, opt_cb, opt_context) {
            request = Util.deepCopy(request);

            Object.defineProperty(request, '__mid', { value:this.cur_mid++ });
            if (request.uri.charAt(0) != '/' && /:\/\//.test(request.uri) == false) {
                request.uri = '/' + request.uri;
            }

            Util.log('traffic', this.id ? this.id+'|req' : '|> ', request);

            __processQueryParams(request);

            var handlers = HttpRouter__findHandlers.call(this, request);        
            Object.defineProperty(request, '__bubble_handlers', { value:[], writable:true });
            Object.defineProperty(request, '__capture_handlers', { value:[], writable:true });
            for (var i=0; i < handlers.length; i++) {
                if (handlers[i].bubble) {
                    // bubble handlers are FILO, so we prepend
                    request.__bubble_handlers.unshift(handlers[i]);
                } else {
                    request.__capture_handlers.push(handlers[i]);
                }
            }

            var dispatch_promise = new Promise();
            opt_cb && dispatch_promise.then(opt_cb, opt_context);
            this.response_cbs.forEach(function(cb) {
                dispatch_promise.then(cb.fn, cb.context);
            });
            Object.defineProperty(request, '__dispatch_promise', { value:dispatch_promise });

            var self = this;
            setTimeout(function() { HttpRouter__runHandlers.call(self, request, HttpRouter.response(0)); }, 0);
            return dispatch_promise;
        };

        function HttpRouter__runHandlers(request, response) {
            var handler = request.__capture_handlers.shift();
            if (!handler) { handler = request.__bubble_handlers.shift(); }
            if (handler) {
                var promise = handler.cb.call(handler.context, request, handler.match, response);
                Promise.when(promise, function(response) {
                    HttpRouter__runHandlers.call(this, request, response);
                }, this);
            } else {
                if (!response) { response = HttpRouter.response(404); }
                else if (response.code == 0) { response.code = 404; response.reason = 'not found'; }

                // 404? check remote
                if (response.code == 404) { 
                    __dispatchRemote.call(this, request);
                    return;
                }
                response.org_request = request; // :TODO: if this isn't necessary, it should go

                Util.log('traffic', this.id ? this.id+'|res' : ' >|', response);

                response.body = ContentTypes.deserialize(response.body, response['content-type']);

                request.__dispatch_promise.fulfill(response);
            }
        };

        // :TODO: remove when possible
        HttpRouter.prototype.addResponseListener = function HttpRouter__addResponseListener(fn, opt_context) {
            this.response_cbs.push({ fn:fn, context:opt_context });
        };
        HttpRouter.prototype.removeResponseListener = function HttpRouter__removeResponseListener(fn) {
            this.response_cbs.forEach(function(cb, i) {
                if (cb.fn == fn) {
                    this.response_cbs.splice(i, 1);
                }
            }, this);
        };

        // Pulls the query params into the request.query object
        function __processQueryParams(request) {
            if (request.uri && request.uri.indexOf('?') != -1) {
                request.query = [];
                // pull uri out
                var parts = request.uri.split('?');
                request.uri = parts.shift();
                // iterate the values
                parts = parts.join('').split('&');
                for (var i=0; i < parts.length; i++) {
                    var kv = parts[i].split('=');
                    request.query[kv[0]] = kv[1];
                }
            }
        }

        HttpRouter.prototype.ajaxConfig = function ajaxConfig(k, v) {
            if (typeof v == "undefined") { return this.ajax_config[k]; }
            this.ajax_config[k] = v;
            return v;
        };

        function __dispatchRemote(request) {
            if (typeof window != 'undefined') {
                __sendAjaxRequest.call(this, request);
            } else if (typeof self != 'undefined') {
                // :TODO: workers solution
            } else {
                request.__dispatch_promise.fulfill(HttpRouter.response(404, 'Not Found'));
            }
        }
        function __sendAjaxRequest(request) {
            var xhrRequest = new XMLHttpRequest();
            var target_uri = request.uri;

            var query = '';
            if (request.query) {
                var q = [];
                for (var k in request.query) {
                    q.push(k+'='+request.query[k]);
                }
                if (q.length) {
                    query = '?' + q.join('&');
                }
            }

            if (this.ajax_config.proxy && /:\/\//.test(target_uri)) { // only use proxy if a protocol-qualified URL
                request[this.ajax_config.proxy_query_header] = query;
                target_uri = this.ajax_config.proxy + '?url=' + request.uri;
            } else {
                target_uri += query;
            }

            request.body = ContentTypes.serialize(request.body, request['content-type']);
            xhrRequest.open(request.method, target_uri, true);
            for (var k in request) {
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
                    response.org_request = request; // :TODO: remove if possible
                    response.body = ContentTypes.deserialize(xhrRequest.responseText, response['content-type']);

                    Util.log('traffic', this.id ? this.id+'|res' : ' >|', response);
                    request.__dispatch_promise.fulfill(response);
                }
            };
            xhrRequest.send(request.body);
        };

        HttpRouter.route = function HttpRouter__route(cb, match, bubble) {
            return { cb:cb, match:match, bubble:bubble };
        };
        HttpRouter.response = function HttpRouter__response(code, body, contenttype, headers) {
            var response = headers || {};
            response.code = code;
            response.body = body || '';
            response['content-type'] = contenttype || '';
            return response;
        };	
    })();
}