/*
Example:
  apps/foo [ json ] post --pragma="no-cache" convert [ xml ] post apps/bar

command      = request { content-type [ request ] } .
request      = [ method ] uri { header-flag } .
header-flag  = "--" header-key "=" header-value .
content-type = "[" [ token | string ] "]" .
method       = token .
header-key   = token .
header-value = token | string .
*/
define(function() {
    // CLI
    // ===
    // Run HTTP requests in the command line
    var CLI = function(elem_id) {
        this.elemInput = document.getElementById(elem_id);
    };

    // Resource Meta
    // =============
    CLI.prototype.resources = {
        '/':{
            desc:'Linkshui CLI parser & executor.',
            _post:{
                desc:'Parses the given command into a request chain, then executes the chain by piping each response into the next request.'
            }
        }
    };

    // Route handlers
    // ==============
    CLI.prototype.routes = [
        { cb:'commandHandler', uri:'^/?$', method:'post' }
    ];
    CLI.prototype.commandHandler = function(request) {
        //this.parser.logging = true;
        var body = Link.getTypeInterface(request['content-type'], request.body).toObject();
        var promise = new Link.Promise();
        
        // Make sure we got something
        if (!body || !body.cmd) { return { code:205 }; }

        // Clear the input
        this.elemInput.value = '';

        // Dispatch helper
        var self = this;
        var dispatch = function(req, handler) {
            req.cli = true;
            self.mediator.dispatch(req, function(res) {
                res['content-location'] = req.uri; // set the content-location, so the final response goes to that and not the cli uri
                handler(res);
            });
        };
            
        // Parse
        try { var cmdRequests = this.parse(body.cmd); }
        catch(e) { return { code:205, body:e }; }
            
        // Execute with piping
        var handleResponse = function(res) {
            // If failed, break the chain and respond now
            if (res.code >= 400 || res.code == 0) {
                promise.fulfill(res);
            } else {
                // Succeeded, continue the chain
                if (cmdRequests.length) {
                    var nextReq = cmdRequests.shift();
                    // Convert to the target type on mismatch
                    if (nextReq['content-type'] && res['content-type'] != nextReq['content-type']) {
                        var res_as_object = Link.getTypeInterface(res['content-type'], res.body).toObject();
                        nextReq.body = Link.getTypeInterface(nextReq['content-type']).fromObject(res_as_object).data;
                    } else {
                        // direct assign
                        nextReq.body = res.body;
                    }
                    dispatch(nextReq, handleResponse);
                } else {
                    // No more, respond
                    promise.fulfill(res);
                }
            }
        };
        dispatch(cmdRequests.shift(), handleResponse);
        return promise;
    };

    // Parser
    // ======
    CLI.prototype.parse = function(buffer) {
        this.parser.buffer = buffer;
        return this.parser.readCommand();
    };
    CLI.prototype.parser = { buffer:null, logging:false };
    CLI.prototype.parser.readCommand = function() {
        // command = request { content-type [ request ] } .
        // ================================================
        var requests = [], curMimeType, defaultMethod = 'get';
        this.log = ((this.logging) ? (function() { console.log.apply(console,arguments); }) : (function() {}));
        this.log('>> Parsing:',this.buffer);
        // Read requests, expecting mimetypes before each extra one
        while (true) {
            // Read request
            request = this.readRequest();
            if (!request) { break; }

            // Default request method
            if (!request.method) {
                request.method = defaultMethod;
                this.log('Set request to default: ', defaultMethod);
            }
            
            // If previously given a mimetype, use it to describe the body of this request
            if (curMimeType) {
                request['content-type'] = curMimeType;
                this.log('Set content-type to ', curMimeType);
            }
            
            // Add to chain
            requests.push(request);
            
            // Read content type
            curMimeType = this.readContentType();

            // Use to describe the expected response body
            if (curMimeType) {
                requests[requests.length - 1].accept = curMimeType;
                this.log('Set accept to', curMimeType);
            }

            // Switch default to POST from here on out
            defaultMethod = 'post';
        }
        if (requests.length == 0) {
            throw "Expected request";
        }
        this.log('<< Finished parsing:', requests);
        return requests;
    };
    CLI.prototype.parser.readRequest = function() {
        // request = [ method ] uri { header-flag } .
        // ==========================================
        var targetUri, method, headers = {};
        // Read till no more request features
        while (true) {
            var headerSwitch = this.readHeaderSwitch();
            if (headerSwitch) {
                // shouldn't come before method & uri
                if (!targetUri && !method) { throw "Unexpected header flag: " + headerSwitch; }
                headers[headerSwitch.key] = headerSwitch.value;
                continue;
            }
            var uri = this.readURI();
            if (uri) {
                if (method) {
                    // shouldn't have more tokens than method & uri
                    if (targetUri) { throw "Unexpected token: " + uri + ". (Method:" + method + ", Uri:" + targetUri + ")"; }
                    // have a method, set to uri now
                    targetUri = uri;
                } else {
                    // set to method first
                    method = uri;
                }
                continue;
            }
            break;
        }
        // No uri? method probably mistakenly got it
        if (method && !targetUri) {
            targetUri = method;
            method = null; // will need to designate a default elsewhere
        }
        // Return a request if we got a URI; otherwise, no match
        if (!targetUri) { return false; }
        var request = headers;
        request.method = method;
        request.uri = targetUri;
        this.log(request);
        return request;
    };
    CLI.prototype.parser.readContentType = function() {
        // content-type = "[" [ token | string ] "]" .
        // ===========================================
        var match;
        
        // match opening bracket
        match = /^\s*\[\s*/.exec(this.buffer);
        if (!match) { return false; }
        this.moveBuffer(match[0].length);
        
        // read content-type
        match = /^[\w\/\*.0-9]+/.exec(this.buffer);
        var contentType = (!!match ?  match[0] : null);
        //if (!match) { throw "Content-type expected"; }
        contentType && this.moveBuffer(contentType.length);
        
        // match closing bracket
        match = /^\s*\]\s*/.exec(this.buffer);
        if (!match) { throw "Closing bracket ']' expected after content-type"; }
        this.moveBuffer(match[0].length);

        this.log('Read mimetype:', contentType);
        return contentType;
    };
    CLI.prototype.parser.readHeaderSwitch = function() {
        // header-flag = "--" header-key "=" header-value .
        // ================================================
        var match;
    
        // match switch
        match = /^\s*--/.exec(this.buffer);
        if (!match) { return false; }
        this.moveBuffer(match[0].length);

        // match key
        var headerKey = this.readToken();
        if (!headerKey) { throw "Header name expected after '--' switch."; }

        // match '='
        match = /^\s*\=\s*/.exec(this.buffer);
        if (!match) { throw "Value expected for --" + headerKey; }
        this.moveBuffer(match[0].length);

        // match value
        var headerValue = this.readString() || this.readToken();
        if (!headerValue) { throw "Value expected for --" + headerKey; }

        var header = { key:headerKey, value:headerValue };
        this.log('Read header:', header);
        return header;
    };
    CLI.prototype.parser.readString = function() {
        var match;
        
        // match opening quote
        match = /^\s*[\"]/.exec(this.buffer);
        if (!match) { return false; }
        this.moveBuffer(match[0].length);

        // read the string till the next quote
        var string = '';
        while (this.buffer.charAt(0) != '"') {
            var c = this.buffer.charAt(0);
            this.moveBuffer(1);
            if (!c) { throw "String must be terminated by a second quote"; }
            string += c;
        }
        this.moveBuffer(1);

        this.log('Read string:', string);
        return string;
    };
    CLI.prototype.parser.readToken = function() {
        // read the token
        var match = /^\s*(\w+)/.exec(this.buffer);
        if (!match) { return false; }
        this.moveBuffer(match[0].length);
        this.log('Read token:', match[1]);
        return match[1];
    };
    CLI.prototype.parser.readURI = function() {
        var match = /^\s*([\w\/\#]\S*)/.exec(this.buffer);
        if (!match) { return false; }
        this.moveBuffer(match[0].length);
        this.log('Read URI:', match[1]);
        return match[1];
    };
    CLI.prototype.parser.moveBuffer = function(dist) {
        this.buffer = this.buffer.substring(dist);
        this.log('+', dist);
    };
    
    return CLI;
});