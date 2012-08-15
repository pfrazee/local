if (typeof define !== 'function') { var define = require('amdefine')(module) }
define(function() {
    // deep copy helper
    // http://keithdevens.com/weblog/archive/2007/Jun/07/javascript.clone
    var deepCopy = function _clone(obj) {
        if (!obj || typeof obj != 'object') { return obj; }
        var c = new obj.constructor();
        for (var k in obj) { c[k] = deepCopy(obj[k]); }
        return c;
    };

    // Structure
    // =========
    // passes requests/responses around a uri structure of modules
    function Structure(id) {
        this.id = id;
        this.modules = [];
        this.response_cbs = [];
    };

    // Configures the module into the uri structure
    //  - maintains precedence in ordering according to the URI
    //    '#/a' is before '#/a/b' is before '#/a/b/c'
    //  - a duplicate URI is inserted after existing modules
    Structure.prototype.addModule = function Structure__addModule(new_uri, module) {
        // Find the last URI that fits inside or matches the new one
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
    Structure.prototype.removeModules = function Structure__removeModules(uri) {
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
    function Structure__findHandlers(request) {
        var matched_handlers = [];
        this.modules.forEach(function(module) {
            // See if the module's configured URI fits inside the request URI
            var rel_uri_index = request.uri.indexOf(module.uri);
            if (rel_uri_index == 0) {
                // Is it a complete name match? (/foo matches /foo/bar, not /foobar)
                var rel_uri = request.uri.substr(module.uri.length);
                if (!(rel_uri == '' || rel_uri.charAt(0) == '/')) {
                    return;
                }
                // It is-- use the rel URI to match the request
                if (rel_uri.charAt(0) != '/') { rel_uri = '/' + rel_uri; } // prepend the leading slash, for consistency
                // Look for the handler
                for (var j=0; j < module.inst.routes.length; j++) {
                    var route = module.inst.routes[j];
                    var match, matches = {};
                    // Test route params
                    for (var k in route.match) {
                        match = true;
                        // key exists
                        if (!(k in request)) {
                            log('routing', ' > ',module.inst,route.cb,'MISS ('+k+')');
                            match = false;
                            break;
                        }
                        var reqVal = (k == 'uri' ? rel_uri : request[k]);
                        // convert strings to regexps
                        if (typeof(route.match[k]) == 'string') { route.match[k] = new RegExp(route.match[k], 'i'); }
                        // regexp test
                        if (route.match[k] instanceof RegExp) {
                            match = route.match[k].exec(reqVal)
                            if (!match) { 
                                log('routing', ' > ',module.inst,route.cb,'MISS ('+k+' "'+reqVal+'")');
                                break; 
                            }
                            matches[k] = match;
                        }
                        // standard equality
                        else {
                            if (route.match[k] != reqVal) { 
                                log('routing', ' > ',module.inst,route.cb,'MISS ('+k+' "'+reqVal+'")');
                                match = false; break; 
                            }
                            matches[k] = reqVal;
                        }
                    }
                    // Ended the loop because it wasn't a match?
                    if (!match) { continue; }
                    // A match, get the cb
                    log('routing', ' > ',module.inst,route.cb,'MATCH');
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
    var cur_mid = 1;
    Structure.prototype.dispatch = function Structure__dispatch(request, opt_cb, opt_context) {
        // Duplicate the request object
        // :TODO: not sure if I want this (complicates obj ref sharing within the browser)
        request = deepCopy(request);
        // Assign an id, for debugging
        Object.defineProperty(request, '__mid', { value:cur_mid++, writable:true });
        // Make any auto-corrections
        if (request.uri.charAt(0) != '/' && /:\/\//.test(request.uri) == false) {
            request.uri = '/' + request.uri;
        }
        // Log
        log('traffic', this.id ? this.id+'|req' : '|> ', request.__mid, request.uri, request.accept ? '['+request.accept+']' : '', request);
        // Pull the query params out, if present
        __processQueryParams(request);
        // Build the handler chain
        var handlers = Structure__findHandlers.call(this, request);        
        Object.defineProperty(request, '__bubble_handlers', { value:[], writable:true });
        Object.defineProperty(request, '__capture_handlers', { value:[], writable:true });
        for (var i=0; i < handlers.length; i++) {
            if (handlers[i].bubble) {
                // Bubble handlers are FILO, so we prepend
                request.__bubble_handlers.unshift(handlers[i]);
            } else {
                request.__capture_handlers.push(handlers[i]);
            }
        }
        // Store the dispatcher handler
        var dispatchPromise = new Promise();
        opt_cb && dispatchPromise.then(opt_cb, opt_context);
        this.response_cbs.forEach(function(cb) {
            dispatchPromise.then(cb.fn, cb.context);
        });
        Object.defineProperty(request, '__dispatch_promise', { value:dispatchPromise });
        // Begin handling next tick
        var self = this;
        setTimeout(function() { Structure__runHandlers.call(self, request, mkresponse(0)); }, 0);
        return dispatchPromise;
    };

    // Processes the request's handler chain
    function Structure__runHandlers(request, response) {
        // Find next handler
        var handler = request.__capture_handlers.shift();
        if (!handler) { handler = request.__bubble_handlers.shift(); }
        if (handler) {
            // Run the cb
            var promise = handler.cb.call(handler.context, request, handler.match, response);
            when(promise, function(response) {
                Structure__runHandlers.call(this, request, response);
            }, this);
        } else {
            // Out of callbacks -- create a response if we dont have one
            if (!response) { response = mkresponse(404); }
            else if (response.code == 0) { response.code = 404; response.reason = 'not found'; }
            // 404? check remote
            if (response.code == 404) { 
                __dispatchRemote(request);
                return;
            }
            response.org_request = request;
            // Log
            log('traffic', this.id ? this.id+'|res' : ' >|', request.__mid, request.uri, response['content-type'] ? '['+response['content-type']+']' : '', response);
            // Decode to object form
            response.body = decodeType(response.body, response['content-type']);
            // Send to original promise
            request.__dispatch_promise.fulfill(response);
        }
    };

    // Dispatch sugars
    Structure.prototype.get = function Structure__get(request, opt_cb, opt_context) {
        request.method = 'get';
        return this.dispatch(request, opt_cb, opt_context);
    };
    Structure.prototype.post = function Structure__post(request, opt_cb, opt_context) {
        request.method = 'post';
        return this.dispatch(request, opt_cb, opt_context);
    };

    // Response callbacks
    Structure.prototype.addResponseListener = function Structure__addResponseListener(fn, opt_context) {
        this.response_cbs.push({ fn:fn, context:opt_context });
    };
    Structure.prototype.removeResponseListener = function Structure__removeResponseListener(fn) {
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

    // Builds a route object
    function mkroute(cb, match, bubble) {
        return { cb:cb, match:match, bubble:bubble };
    };

    // Builds a response object
    function mkresponse(code, body, contenttype, headers) {
        var response = headers || {};
        response.code = code;
        response.body = body || '';
        response['content-type'] = contenttype || '';
        return response;
    };
    
    // Type En/Decoding
    // ================
    var typeEncoders = {};
    var typeDecoders = {};
    // Converts objs/strings to from objs/strings
    function encodeType(obj, type) {
        // sanity
        if (obj == null || typeof(obj) != 'object' || type == null) {
            return obj;
        }
        // find encoder
        var encoder = __findCoder(typeEncoders, type);
        if (!encoder) { 
            log('err_types', 'Unable to encode', type, '(no encoder found)');
            return obj; 
        }
        // run
        return encoder(obj);
    }
    function decodeType(str, type) {
        // sanity
        if (str == null || typeof(str) != 'string' || type == null) {
            return str;
        }
        // find decoder
        var decoder = __findCoder(typeDecoders, type);
        if (!decoder) { 
            log('err_types', 'Unable to decode', type, '(no decoder found)');
            return str; 
        }
        // run
        return decoder(str);
    }
    // Adds en/decoders to the registries
    function setTypeEncoder(type, fn) {
        typeEncoders[type] = fn;
    }
    function setTypeDecoder(type, fn) {
        typeDecoders[type] = fn;
    }
    // Takes a mimetype (text/asdf+html), puts out the applicable types ([text/asdf+html, text/html,text])
    function __mkTypesList(type) {
        // for now, dump the encoding
        var parts = type.split(';');
        var t = parts[0];
        parts = t.split('/');
        if (parts[1]) {
            var parts2 = parts[1].split('+');
            if (parts2[1]) { 
                return [t, parts[0] + '/' + parts2[1], parts[0]];
            }
            return [t, parts[0]];
        }
        return [t];
    };
    // Takes a registry and type, finds the best matching en/decoder
    function __findCoder(registry, type) {
        var types = __mkTypesList(type);
        for (var i=0; i < types.length; i++) {
            if (types[i] in registry) { return registry[types[i]]; }
        }
        return null;
    };
    // Default en/decoders
    setTypeEncoder('application/json', function(obj) {
        return JSON.stringify(obj);
    });
    setTypeDecoder('application/json', function(str) {
        try {
            var obj = JSON.parse(str);
            return obj;
        } catch (e) {
            console.log('application/json decode failed', e);
            return {};
        }
    });
    setTypeEncoder('application/x-www-form-urlencoded', function(obj) {
        var enc = encodeURIComponent;
        var str = [];
        for (var k in obj) {
            if (obj[k] === null) {
                str.push(k+'=');
            } else if (Array.isArray(obj[k])) {
                for (var i=0; i < obj[k].length; i++) {
                    str.push(k+'[]='+enc(obj[k][i]));
                }
            } else if (typeof obj[k] == 'object') {
                for (var k2 in obj[k]) {
                    str.push(k+'['+k2+']='+enc(obj[k][k2]));
                }
            } else {
                str.push(k+'='+enc(obj[k]));
            }
        }
        return str.join('&');
    });
    setTypeDecoder('application/x-www-form-urlencoded', function(params) {
        // thanks to Brian Donovan
        // http://stackoverflow.com/a/4672120
        var pairs = params.split('&'),
        result = {};

        for (var i = 0; i < pairs.length; i++) {
            var pair = pairs[i].split('='),
            key = decodeURIComponent(pair[0]),
            value = decodeURIComponent(pair[1]),
            isArray = /\[\]$/.test(key),
            dictMatch = key.match(/^(.+)\[([^\]]+)\]$/);

            if (dictMatch) {
                key = dictMatch[1];
                var subkey = dictMatch[2];

                result[key] = result[key] || {};
                result[key][subkey] = value;
            } else if (isArray) {
                key = key.substring(0, key.length-2);
                result[key] = result[key] || [];
                result[key].push(value);
            } else {
                result[key] = value;
            }
        }

        return result;
    });
    
    // Promise
    // =======
    // a value which can defer fulfillment; used for conditional async
    function Promise() {
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
    function when(value, cb, opt_context) {
        if (value instanceof Promise) {
            value.then(cb, opt_context);
        } else {
            cb.call(opt_context, value);
        }
    }

    // Helper to handle multiple promises in one when statement
    function whenAll(values, cb, opt_context) {
        var total = values.length, fulfilled = 0;
        // if no length, presume an empty array and call back immediately
        if (!total) { return cb.call(opt_context, []); }
        // wait for all to finish
        for (var i=0; i < total; i++) {
            Link.Promise.when(values[i], function(v) {
                values[this.i] = v; // replace with result
                if (++fulfilled == total) {
                    cb.call(opt_context, values);
                }
            }, { i:i });
        }
    }

    // Ajax and Util
    // =============
    // Hash of enabled logging mods
    var active_log_modes = {};
    // Configures remote requests in the browser (proxy)
    var ajax_config = {
        proxy:null,
        proxy_query_header:'x-proxy-query',
    };
    
    // Hash of active logging modes
    function logMode(k, v) {
        if (v === undefined) { return active_log_modes[k]; }
        active_log_modes[k] = v;
        return v;
    };

    // Custom logger
    function log(channel) {
        if (logMode(channel)) {
            var args = Array.prototype.slice.call(arguments, 1);
            console.log.apply(console, args);
        }
    };

    // Ajax config accessor
    function ajaxConfig(k, v) {
        if (v == undefined) { return ajax_config[k]; }
        ajax_config[k] = v;
        return v;
    };

    // Helper to send ajax requests
    function __dispatchRemote(request) {
        if (typeof window != 'undefined') {
            __sendAjaxRequest(request);
        } else {
            request.__dispatch_promise.fulfill(mkresponse(404, 'Not Found'));
        }
    }
    function __sendAjaxRequest(request) {
        // Create remote request
        var xhrRequest = new XMLHttpRequest();
        var target_uri = request.uri;
        // Add the query
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
        // Use the proxy, if enabled and targetting a protocol-qualified URI
        if (ajax_config.proxy && /:\/\//.test(target_uri)) {
            request[ajax_config.proxy_query_header] = query;
            target_uri = ajax_config.proxy + '?url=' + request.uri;
        } else {
            target_uri += query;
        }
        // Encode the body
        request.body = encodeType(request.body, request['content-type']);
        xhrRequest.open(request.method, target_uri, true);
        // Set the request headers
        for (var k in request) {
            if (k == 'method' || k == 'uri' || k == 'body') { continue; }
            if (k.indexOf('__') == 0) { continue; }
            var header = request[k];
            if (header == 'object') {
                if (header.length) { header = header.join(' '); }
                else { header = header.toString(); }
            }
            xhrRequest.setRequestHeader(k, header);
        }
        xhrRequest.onreadystatechange = function() {
            // Response received:
            if (xhrRequest.readyState == 4) {
                // Parse headers
                var headers = {};
                var hp = xhrRequest.getAllResponseHeaders().split("\n");
                var hpp;
                // :NOTE: a bug in firefox causes getAllResponseHeaders to return an empty string on CORS
                // we either need to bug them, or iterate the headers we care about with getResponseHeader
                for (var i=0; i < hp.length; i++) {
                    if (!hp[i]) { continue; }
                    hpp = hp[i].toLowerCase().replace('\r','').split(': ');
                    headers[hpp[0]] = hpp[1];
                }
                // Build the response
                var xhrResponse = headers;
                xhrResponse.code = xhrRequest.status;
                xhrResponse.reason = xhrRequest.statusText;
                xhrResponse.body = xhrRequest.responseText;
                xhrResponse.org_request = request;
                // Decode into an object (if possible)
                xhrResponse.body = decodeType(xhrResponse.body, xhrResponse['content-type']);
                // Log
                log('traffic', this.id ? this.id+'|res' : ' >|', request.__mid, request.uri, xhrResponse['content-type'] ? '['+xhrResponse['content-type']+']' : '', xhrResponse);
                // Send to original promise
                request.__dispatch_promise.fulfill(xhrResponse);
            }
        };
        xhrRequest.send(request.body);
    };

    // Exports
    // =======
    return {
        Promise        : Promise,
        when           : when,
        whenAll        : whenAll,
        Structure      : Structure,
        setTypeEncoder : setTypeEncoder,
        setTypeDecoder : setTypeDecoder,
        encodeType     : encodeType,
        decodeType     : decodeType,
        route          : mkroute,
        response       : mkresponse,
        logMode        : logMode,
        log            : log,
        ajaxConfig     : ajaxConfig
    };
});
