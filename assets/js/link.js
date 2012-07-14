if (typeof define !== 'function') { var define = require('amdefine')(module) }
define(function() {
    // Structure
    // =========
    // passes requests/responses around a uri structure of modules
    var Structure = function _Structure(id) {
        this.id = id;
        this.modules = [];
    };

    // Configures the module into the uri structure
    //  - maintains precedence in ordering according to the URI
    //    '#/a' is before '#/a/b' is before '#/a/b/c'
    //  - a duplicate URI is inserted after existing modules
    Structure.prototype.addModule = function(new_uri, module) {
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

    // Searches modules for handlers for the given request
    //  - returns an array of objects with the keys { cb, module, match, route }
    //  - returns the handlers in the order of module precedence
    Structure.prototype.findHandlers = function(request) {
        var matched_handlers = [];
        for (var i=0; i < this.modules.length; i++) {
            var module = this.modules[i];
            // See if the module's configured URI fits inside the request URI
            var rel_uri_index = request.uri.indexOf(module.uri);
            if (rel_uri_index != -1) {
                // It does-- pull out the remaining URI and use that to match the request
                var rel_uri = request.uri.substr(module.uri.length);
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
                            if (logMode('routing')) {
                                console.log(' > ',module.inst,route.cb,'MISS ('+k+')');
                            }
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
                                if (logMode('routing')) {
                                    console.log(' > ',module.inst,route.cb,'MISS ('+k+' "'+reqVal+'")');
                                }
                                break; 
                            }
                            matches[k] = match;
                        }
                        // standard equality
                        else {
                            if (route.match[k] != reqVal) { 
                                if (logMode('routing')) {
                                    console.log(' > ',module.inst,route.cb,'MISS ('+k+' "'+reqVal+'")');
                                }
                                match = false; break; 
                            }
                            matches[k] = reqVal;
                        }
                    }
                    // Ended the loop because it wasn't a match?
                    if (!match) { continue; }
                    // A match, get the cb
                    if (logMode('routing')) {
                        console.log(' > ',module.inst,route.cb,'MATCH');
                    }
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
        }
        return matched_handlers;
    };

    // (ASYNC) Builds the handler chain from the request, then runs
    //  - When finished, calls the given cb with the response
    //  - If the request target URI does not start with a hash, will run the remote handler
    var cur_mid = 1;
    Structure.prototype.dispatch = function(request, opt_cb, opt_context) {
        // Duplicate the request object
        // :TODO: probably shouldn't use this hack for performance reasons
        if (request.body && request['content-type']) {
            request.body = encodeType(request.body, request['content-type']);
        }
        request = JSON.parse(JSON.stringify(request));
        if (request.body && request['content-type']) {
            request.body = decodeType(request.body, request['content-type']);
        }
        // Assign an id, for debugging
        Object.defineProperty(request, '__mid', { value:cur_mid++, writable:true });
        // Log
        if (logMode('traffic')) {
            console.log(this.id ? this.id+'|req' : '|> ', request.__mid, request.uri, request.accept ? '['+request.accept+']' : '', request);
        }
        // If in browser & no hash, use ajax
        if (typeof window !== 'undefined' && request.uri.charAt(0) != '#') {
            __sendAjaxRequest(request, opt_cb, opt_context);
            return;
        }
        // Pull the query params out, if present
        __processQueryParams(request);
        // Build the handler chain
        var handlers = this.findHandlers(request);        
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
        Object.defineProperty(request, '__dispatch_promise', { value:dispatchPromise });
        // Begin handling next tick
        var self = this;
        setTimeout(function() { self.runHandlers(request, mkresponse(0)); }, 0);
        return dispatchPromise;
    };

    // Processes the request's handler chain
    Structure.prototype.runHandlers = function _runHandlers(request, response) {
        // Find next handler
        var handler = request.__capture_handlers.shift();
        if (!handler) { handler = request.__bubble_handlers.shift(); }
        if (handler) {
            // Run the cb
            var promise = handler.cb.call(handler.context, request, handler.match, response);
            when(promise, function(response) {
                this.runHandlers(request, response);
            }, this);
        } else {
            // Out of callbacks -- create a response if we dont have one
            if (!response) { response = mkresponse(404); }
            else if (response.code == 0) { response.code = 404; response.reason = 'not found'; }
            // Log
            if (logMode('traffic')) {
                console.log(this.id ? this.id+'|res' : ' >|', request.__mid, request.uri, response['content-type'] ? '['+response['content-type']+']' : '', response);
            }
            // Decode to object form
            response.body = decodeType(response.body, response['content-type']);
            // Send to original promise
            request.__dispatch_promise.fulfill(response);
        }
    };

    // Dispatch sugars
    Structure.prototype.get = function(request, opt_cb, opt_context) {
        request.method = 'get';
        return this.dispatch(request, opt_cb, opt_context);
    };
    Structure.prototype.post = function(request, opt_cb, opt_context) {
        request.method = 'post';
        return this.dispatch(request, opt_cb, opt_context);
    };

    // Pulls the query params into the request.query object
    var __processQueryParams = function(request) {
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
    };

    // Builds a route object
    var mkroute = function _route(cb, match, bubble) {
        return { cb:cb, match:match, bubble:bubble };
    };

    // Builds a response object
    var mkresponse = function _response(code, body, contenttype, headers) {
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
    var encodeType = function _encodeType(obj, type) {
        // sanity
        if (obj == null || typeof(obj) != 'object' || type == null) {
            return obj;
        }
        // find encoder
        var encoder = __findCoder(typeEncoders, type);
        if (!encoder) { return obj; }
        // run
        return encoder(obj);
    };
    var decodeType = function _decodeType(str, type) {
        // sanity
        if (str == null || typeof(str) != 'string' || type == null) {
            return str;
        }
        // find decoder
        var decoder = __findCoder(typeDecoders, type);
        if (!decoder) { return str; }
        // run
        return decoder(str);
    };
    // Adds en/decoders to the registries
    var setTypeEncoder = function _setTypeEncoder(type, fn) {
        typeEncoders[type] = fn;
    };
    var setTypeDecoder = function _setTypeDecoder(type, fn) {
        typeDecoders[type] = fn;
    };
    // Takes a mimetype (text/asdf+html), puts out the applicable types ([text/asdf+html, text/html,text])
    function __mkTypesList(type) {
        var parts = type.split('/');
        if (parts[1]) {
            var parts2 = parts[1].split('+');
            if (parts2[1]) { 
                return [type, parts[0] + '/' + parts2[1], parts[0]];
            }
            return [type, parts[0]];
        }
        return [type];
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
        return JSON.parse(str);
    });
    
    // Promise
    // =======
    // a value which can defer fulfillment; used for conditional async
    var Promise = function _Promise() {
        this.is_fulfilled = false;
        this.value = null;
        this.then_cbs = [];
    };

    // Runs any `then` callbacks with the given value
    Promise.prototype.fulfill = function(value) {
        if (this.is_fulfilled) { return; }
        this.is_fulfilled = true;
        // Store
        this.value = value;
        // Call thens
        for (var i=0; i < this.then_cbs.length; i++) {
            var cb = this.then_cbs[i];
            cb.func.call(cb.context, value);
        }
    };

    // Adds a callback to be run when the promise is fulfilled
    Promise.prototype.then = function(cb, opt_context) {
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
    var when = function _when(value, cb, opt_context) {
        if (value instanceof Promise) {
            value.then(cb, opt_context);
        } else {
            cb.call(opt_context, value);
        }
    };

    // Helper to handle multiple promises in one when statement
    var whenAll = function _whenAll(values, cb, opt_context) {
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
    };

    // Window Behavior
    // ===============
    // Structure listening to window events
    var window_structure = null;
    // Handler for window responses
    var window_handler = { cb:null, context:null };
    // Used to avoid duplicate hash-change handling
    var expected_hashchange = null;
    // Hash of enabled logging mods
    var active_log_modes = {};
    // Configures remote requests in the browser (proxy)
    var ajax_config = {
        proxy:null,
        proxy_header:'x-proxy-dest',
    };
    
    // Hash of active logging modes
    var logMode = function(k, v) {
        if (v === undefined) { return active_log_modes[k]; }
        active_log_modes[k] = v;
        return v;
    };

    // Ajax config accessor
    var ajaxConfig = function(k, v) {
        if (v == undefined) { return ajax_config[k]; }
        ajax_config[k] = v;
        return v;
    };

    // Helper to send ajax requests
    var __sendAjaxRequest = function(request, opt_cb, opt_context) {
        // Create remote request
        var xhrRequest = new XMLHttpRequest();
        var target_uri = request.uri;
        // Use the proxy, if enabled
        if (ajax_config.proxy) {
            request[ajax_config.proxy_header] = request.uri;
            target_uri = ajax_config.proxy;
        }
        // Encode the body
        if (request.body && typeof(request.body) == 'string' && request['content-type']) {
            request.body = encodeType(request.body, request['content-type']);
        }
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
                var headers_parts = xhrRequest.getAllResponseHeaders().split("\n");
                // :NOTE: a bug in firefox causes getAllResponseHeaders to return an empty string on CORS
                // we either need to bug them, or iterate the headers we care about with getResponseHeader
                for (var i=0; i < headers_parts.length; i++) {
                    if (!headers_parts[i]) { continue; }
                    var header_parts = headers_parts[i].toLowerCase().split(': ');
                    headers[header_parts[0]] = header_parts[1];
                }
                // Build the response
                var xhrResponse = headers;
                xhrResponse.code = xhrRequest.status;
                xhrResponse.reason = xhrRequest.statusText;
                xhrResponse.body = xhrRequest.responseText;
                if (logMode('traffic')) {
                    console.log(this.id ? this.id+'|res' : ' >|', request.__mid, request.uri, xhrResponse['content-type'] ? '['+xhrResponse['content-type']+']' : '', xhrResponse);
                }
                // Pass on
                opt_cb.call(opt_context, xhrResponse);
            }
        };
        xhrRequest.send(request.body);
    };

    // Click interceptor -- helps with form submissions
    var __windowClickHandler = function(e) {
        // Mark as recently clicked, if this (or a parent) is part of a form
        var node = e.target;
        while (node) {
            if (node.form) {
                for (var i=0; i < node.form.length; i++) {
                    node.form[i].setAttribute('clicked', null); // clear the others out, to be safe
                }
                node.setAttribute('clicked', '1');
                break;
            }
            node = node.parentNode;
        }
    };

    // Submit interceptor -- handles forms with requests within the application
    var __windowSubmitHandler = function(e) {
        var form = e.target;
        var target_uri, enctype, method;

        // :NOTE: a lot of default browser behaviour has to (?) be emulated here

        // Serialize the data
        var data = {};
        for (var i=0; i < form.length; i++) {
            var elem = form[i];
            // Pull value if it has one
            if (elem.value) {
                // don't pull from buttons unless recently clicked
                if (elem.tagName == 'button' || (elem.tagName == 'input' && (elem.type == 'button' || elem.type == 'submit')) ){
                    if (elem.getAttribute('clicked')) {
                        data[elem.name] = elem.value;
                    }
                } else {
                    data[elem.name] = elem.value;
                }
            }
            // If was recently clicked, pull its request attributes-- it's our submitter
            if (elem.getAttribute('clicked') == '1') {
                target_uri = elem.getAttribute('formaction');
                enctype = elem.getAttribute('formenctype');
                method = elem.getAttribute('formmethod');
                elem.setAttribute('clicked', '0');
            }
        }

        // If no element gave request attributes, pull them from the form
        if (!target_uri) { target_uri = form.action; }
        if (!enctype) { enctype = form.enctype; }
        if (!method) { method = form.method; }

        // Convert the data to the given enctype
        if (!enctype) { enctype = 'js'; }
        // :TODO: ?
        
        // Strip the base URI
        var base_uri = window.location.href.split('#')[0];
        if (target_uri.indexOf(base_uri) != -1) {
            target_uri = target_uri.substring(base_uri.length);
        }
        
        // Default to the current resource
        if (!target_uri) { target_uri = window.location.hash; }
        
        // Don't handle if a remote link
        //if (target_uri.charAt(0) != '#') { return; }
        e.preventDefault();
        if (e.stopPropagation) { e.stopPropagation(); }

        // Build the request
        var request = {
            method:method,
            uri:target_uri,
            accept:'text/html'
        };
        if (form.acceptCharset) { request.accept = form.acceptCharset; }

        // Build request body
        if (form.method == 'get') {
            var qparams = [];
            for (var k in data) {
                qparams.push(k + '=' + data[k]);
            }
            if (qparams.length) {
                target_uri += '?' + qparams.join('&');
                request.uri = target_uri;
            }
        } else {
            request.body = data;
            request['content-type'] = enctype;
        }
        
        // Handle
        followRequest(request);
    };
    
    // Hashchange interceptor -- handles changes to the hash with requests within the application
    var __windowHashchangeHandler = function() {
        // Build the request from the hash
        var uri = window.location.hash;
        if (expected_hashchange == uri || (expected_hashchange == '#' && uri == '')) {
            expected_hashchange = null; // do nothing if this has been handled elsewhere
            return;
        }
        expected_hashchange = null;
        if (uri == null || uri == '') { uri = '#'; }
        followRequest({ method:'get', uri:uri, accept:'text/html' });
    };

    // Dispatches a request, then renders it to the window on return
    var followRequest = function(request) {
        window_structure.dispatch(request, function(response) {
            // If a redirect, do that now
            if (response.code >= 300 && response.code < 400) {
                followRequest({ method:'get', uri:response.location, accept:'text/html' });
                return;
            }
            // Pass on to handler
            if (window_handler.cb) {
                window_handler.cb.call(window_handler.context, request, response);
            }
            // If not a 205 Reset Content, then change our hash
            if (response.code != 205) {
                var uri = request.uri;
                if (response['content-location']) { uri = response['content-location']; }
                if (uri.charAt(0) != '#') { uri = '#' + uri; }
                expected_hashchange = uri;
                window.location.hash = uri;
            }
        }, this);
    };
    
    // Registers event listeners to the window and handles the current URI
    var attachToWindow = function(structure, opt_response_cb, opt_response_cb_context) {
        window_structure = structure;
        window_handler = { cb:opt_response_cb, context:opt_response_cb_context };
        
        // Register handlers
        document.onclick = __windowClickHandler;
        document.onsubmit = __windowSubmitHandler;
        window.onhashchange = __windowHashchangeHandler;
    
        // Now follow the current hash's uri
        var uri = window.location.hash;
        if (uri == null || uri == '') { uri = '#'; }
        followRequest({ method:'get', uri:uri, accept:'text/html' });
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
        ajaxConfig     : ajaxConfig,
        attachToWindow : attachToWindow,
    };
});
