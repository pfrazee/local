/*
Example:
  apps/foo [ json ] post --pragma="no-cache" convert [ xml ] post apps/bar

command      = request { content-type [ request ] } .
request      = [ method ] uri { header-flag } .
header-flag  = [ "-" | "--" ] header-key "=" header-value .
content-type = "[" [ token | string ] "]" .
method       = token .
header-key   = token .
header-value = token | string .
uri          = chars
string       = '"' { token } '"'
*/
define(['link', 'lib/linkregistry', 'lib/env', 'lib/history'], function(Link, LinkRegistry, Env, History) {
    // CLI
    // ===
    // Parses a command syntax into Link requests 
    var CLI = {
        elemInput:null,
        structure:null,
        init:__init,
        runCommand:__runCommand,
        prototype:{} // tmp
    };
    
    // setup func    
    function __init(structure, elem_id) {
        this.structure = structure;
        this.elemInput = document.getElementById(elem_id);
        this.elemInput.onkeydown = __clikeydown;
    };

    // input event function
    function __clikeydown(e) {
        if (e.keyCode == 13) { // enter keypress
            // Pull out and clear the value
            var command = CLI.elemInput.value;
            CLI.elemInput.value = '';
            // Pipe into the command handler
            CLI.runCommand(command);
        }
    };

    // command handler
    function __runCommand(command) {
        //Parser.logging = true;
        
        // Make sure we got something
        if (!command) { return; }
            
        // Parse
        try { 
            var cur_request = null;
            var cmd_requests = __parse(command); 
            var request_count = cmd_requests.length;
        } catch(e) {
            // Add to history
            var res = Link.response(400, 0, 0, { reason:e.toString() });
            History.addEntry(command, res);
            return;
        }

        // Replace link aliases
        for (var i=0; i < cmd_requests.length; i++) {
            cmd_requests[i].uri = LinkRegistry.replace(cmd_requests[i].uri);
        }
        
        // Default the last request to accept html if no type is given
        if (!cmd_requests[cmd_requests.length - 1].accept) {
            cmd_requests[cmd_requests.length - 1].accept = 'text/html';
        }
            
        // Execute with piping
        var handleResponse = function(res) {
            // If failed, break the chain
            if (res.code >= 400 || res.code == 0) {
                // Chain broken: send to environment
                Env.handleResponse(res);
                // Highlight the offending command, if multiple exist
                if (request_count > 1) {
                    command = command.replace(cur_request.cli_cmd, '<strong>'+cur_request.cli_cmd+'</strong>');
                }
                // Send to history
                History.addEntry(command, res);
            } else {
                // Succeeded, continue the chain
                if (cmd_requests.length) {
                    cur_request = cmd_requests.shift();
                    // Pipe the response into the request
                    cur_request.body = res.body;
                    cur_request['content-type'] = res['content-type'];
                    // Send through the structure
                    CLI.structure.dispatch(cur_request, handleResponse);
                } else {
                    // Chain complete: send to environment
                    Env.handleResponse(res);
                    // Send to history
                    History.addEntry(command, res);
                }
            }
        };
        CLI.structure.dispatch((cur_request = cmd_requests.shift()), handleResponse);
    };

    // Parser
    // ======
    function __parse(buffer) {
        Parser.buffer = buffer;
        Parser.trash = '';
        Parser.buffer_position = 0;
        return Parser.readCommand();
    };
    Parser = { buffer:null, trash:null, buffer_position:0, logging:false };
    Parser.readCommand = function() {
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
    Parser.readRequest = function() {
        // request = [ method ] uri { header-flag } .
        // ==========================================
        var targetUri = false, method = false, headers = {}, start_pos;
        start_pos = this.buffer_position;
        // Read till no more request features
        while (true) {
            var headerSwitch = this.readHeaderSwitch();
            if (headerSwitch) {
                // shouldn't come before method & uri
                if (!targetUri && !method) { throw "Unexpected header flag '" + headerSwitch + "'"; }
                headers[headerSwitch.key] = headerSwitch.value;
                continue;
            }
            var string = this.readNonSpaces();
            if (string) {
                // no uri, assume that's what it is
                if (!targetUri) { targetUri = string; }
                else if (!method) {
                    // no method, the first item was actually the method and this is the uri
                    method = targetUri;
                    targetUri = string;
                } else {
                    throw "Unexpected token '" + string + "'";
                }
                continue;
            }
            break;
        }
        // Return a request if we got a URI; otherwise, no match
        if (!targetUri) { return false; }
        var request = headers;
        request.method = method;
        request.uri = targetUri;
        Object.defineProperty(request, 'cli_cmd', { value:this.trash.substring(start_pos) });
        this.log(request);
        return request;
    };
    Parser.readContentType = function() {
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
    Parser.readHeaderSwitch = function() {
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
    Parser.readNonSpaces = function() {
        // read pretty much anything
        var match = /^\s*(\S*)/.exec(this.buffer);
        if (match) { 
            this.moveBuffer(match[0].length);
            this.log('Read uri:', match[1]);
            return match[1];
        }

        return false;
    };
    Parser.readString = function() {
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
    Parser.readToken = function() {
        // read the token
        var match = /^\s*([\w]*)/.exec(this.buffer);
        if (!match) { return false; }
        this.moveBuffer(match[0].length);
        this.log('Read token:', match[1]);
        return match[1];
    };
    Parser.moveBuffer = function(dist) {
        this.trash += this.buffer.substring(0, dist);
        this.buffer = this.buffer.substring(dist);
        this.buffer_position += dist;
        this.log('+', dist);
    };
    
    return CLI;
});
