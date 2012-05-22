/*
Example:
  apps/foo [ json ] post --pragma="no-cache" convert [ xml ] post apps/bar

command      = request { content-type [ request ] } .
request      = [ method ] uri { header-flag | header-value } .
header-flag  = [ "-" | "--" ] header-key "=" header-value .
content-type = "[" [ token | string ] "]" .
method       = token .
header-key   = token .
header-value = token | string .
uri          = "#" token | token "://" token .
string       = '"' { token } '"'
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
        try { var cmd_requests = this.parse(body.cmd); }
        catch(e) { return { code:205, body:e }; }
        var request_count = cmd_requests.length;
        var cur_request = null;
            
        // Execute with piping
        var handleResponse = function(res) {
            // If failed, break the chain
            if (res.code >= 400 || res.code == 0) {
                // Respond now
                promise.fulfill(res);
                // Highlight the offending command, if multiple exist
                if (request_count > 1) {
                    body.cmd = body.cmd.replace(cur_request.cli_cmd, '<strong>'+cur_request.cli_cmd+'</strong>');
                }
                // Send to history
                self.mediator.dispatch({ uri:'#hist', method:'post', 'content-type':'js/object', body:{ cmd:body.cmd, response:res }}, function() {
                    self.mediator.dispatch({ uri:'#hist', method:'get', 'accept':'text/html' }, function(response) {
                        // Get HTML out of the response
                        var html = Link.getTypeInterface(response['content-type'], response.body).toHtml();
                        document.getElementById('lshui-hist').innerHTML = html;
                    });
                });
            } else {
                // Succeeded, continue the chain
                if (cmd_requests.length) {
                    cur_request = cmd_requests.shift();
                    // Convert to the target type on mismatch
                    if (cur_request['content-type'] && res['content-type'] != cur_request['content-type']) {
                        var res_as_object = Link.getTypeInterface(res['content-type'], res.body).toObject();
                        cur_request.body = Link.getTypeInterface(cur_request['content-type'], res_as_object).getData();
                    } else {
                        // direct assign
                        cur_request.body = res.body;
                    }
                    dispatch(cur_request, handleResponse);
                } else {
                    // No more, respond
                    promise.fulfill(res);
                    // Send to history
                    self.mediator.dispatch({ uri:'#hist', method:'post', 'content-type':'js/object', body:{ cmd:body.cmd, response:res }}, function() {
                        self.mediator.dispatch({ uri:'#hist', method:'get', 'accept':'text/html' }, function(response) {
                            // Get HTML out of the response
                            var html = Link.getTypeInterface(response['content-type'], response.body).toHtml();
                            document.getElementById('lshui-hist').innerHTML = html;
                        });
                    });
                }
            }
        };
        dispatch((cur_request = cmd_requests.shift()), handleResponse);
        return promise;
    };

    // Parser
    // ======
    CLI.prototype.parse = function(buffer) {
        this.parser.buffer = buffer;
        this.parser.trash = '';
        this.parser.buffer_position = 0;
        return this.parser.readCommand();
    };
    CLI.prototype.parser = { buffer:null, trash:null, buffer_position:0, logging:false };
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
        // request = [ method ] uri { header-flag | header-value } .
        // ==========================================
        var targetUri = false, method, headers = {}, start_pos;
        start_pos = this.buffer_position;
        // Read till no more request features
        while (true) {
            var headerSwitch = this.readHeaderSwitch();
            if (headerSwitch) {
                // shouldn't come before method & uri
                if (!targetUri && !method) { throw "Unexpected header flag: " + headerSwitch; }
                headers[headerSwitch.key] = headerSwitch.value;
                continue;
            }
            if (!targetUri) {
                // try to read if we haven't gotten it yet
                targetUri = this.readUri();
                if (targetUri) { continue; }
            }
            var token = this.readToken() || this.readString();
            if (token) {
                // if we have the uri or method, then its a header flag
                if (targetUri || method) {
                    if (!headers.argv) { headers.argv = []; }
                    headers.argv.push(token);
                } else {
                    // must be the method
                    method = token;
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
        request.cli_cmd = this.trash.substring(start_pos);
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
        // header-flag = [ "-" | "--" ] header-key "=" header-value .
        // ================================================
        var match, headerKey, headerValue;
    
        // match switch
        match = /^\s*-[-]*/.exec(this.buffer);
        if (!match) { return false; }
        this.moveBuffer(match[0].length);

        // match key
        headerKey = this.readToken();
        if (!headerKey) { throw "Header name expected after '--' switch."; }

        // match '='
        match = /^\s*\=\s*/.exec(this.buffer);
        if (match) {
            // match value
            this.moveBuffer(match[0].length);
            headerValue = this.readString() || this.readToken();
            if (!headerValue) { throw "Value expected for --" + headerKey; }
        } else {
            // default value to `true`
            headerValue = true;
        }
        
        var header = { key:headerKey, value:headerValue };
        this.log('Read header:', header);
        return header;
    };
    CLI.prototype.parser.readUri = function() {
        // uri = "#" token | token "://" token .
        // =====================================
        var match, uri;
        var uriregex = /^([^\s]\S*)/;
    
        // match hash
        match = /^\s*#/.exec(this.buffer);
        if (match) {
            this.moveBuffer(match[0].length);
            // read the rest of the uri
            uri = '#';
            match = uriregex.exec(this.buffer);
            if (match) { 
                this.moveBuffer(match[0].length);
                uri += match[0];
            }
            this.log('Read uri:', uri);
            return uri;
        }

        // match protocol separator
        match = /^\s*\w*:\/\//.exec(this.buffer);
        if (match) {
            match = uriregex.exec(this.buffer);
            this.moveBuffer(match[0].length);
            uri = match[0];
            this.log('Read uri:', uri);
            return uri;
        }

        return false;
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
        var match = /^\s*([\w]*)/.exec(this.buffer);
        if (!match) { return false; }
        this.moveBuffer(match[0].length);
        this.log('Read token:', match[1]);
        return match[1];
    };
    CLI.prototype.parser.moveBuffer = function(dist) {
        this.trash += this.buffer.substring(0, dist);
        this.buffer = this.buffer.substring(dist);
        this.buffer_position += dist;
        this.log('+', dist);
    };
    
    return CLI;
});