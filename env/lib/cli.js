/*
Example:
  apps/foo [ json ] post --pragma="no-cache" convert [ xml ] post apps/bar

command      = [ agent ] request { content-type [ request ] } .
agent        = token '>' .
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
        init:CLI__init,
        runCommand:CLI__runCommand,
        addHistory:CLI__addHistory,
        moveHistory:CLI__moveHistory,
        addListener:CLI__addListener,
        removeListener:CLI__removeListener,
        removeAllListeners:CLI__removeAllListeners
    };
    
    // setup func    
    function CLI__init(structure, elem_id) {
        // init attributes
        this.structure = structure;
        this.elemInput = document.getElementById(elem_id);
        this.elemInput.onkeydown = __clikeydown;
        this.listeners = {
            response:[]
        };

        // init history
        this.history = [''];
        this.hindex = 0;
        this.hlen = 1;

        // set up the prompt
        var prompt_elem = document.getElementById('lshui-cli-prompt');
        var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        var twoDigits = function(v) { return ((v < 10) ? '0' : '') + v; };
        var setPrompt = function() {
            var now = new Date();
            var tickanim = ['&#9777;','&#9778;','&#9780;','&#9782;','&#9783;','&#9779;'];
            prompt_elem.innerHTML = '' + twoDigits(now.getHours()) + ':' + twoDigits(now.getMinutes()) + tickanim[now.getSeconds() % tickanim.length] + ' ' + months[now.getMonth()] + twoDigits(now.getDate());
        };
        setInterval(setPrompt, 1000);
        setPrompt();
    };

    // input event function
    var KEYS = { enter:13, up:38, down:40 };
    function __clikeydown(e) {
        switch (e.keyCode) {
            case KEYS.enter:
                // Pull out and clear the value
                var command = CLI.elemInput.value;
                CLI.elemInput.value = '';
                // Pipe into the command handler
                CLI.runCommand(command);
                CLI.addHistory(command);
                break;
            case KEYS.up:
            case KEYS.down:
                CLI.moveHistory((e.keyCode == KEYS.up) ? 1 : -1);
                break;
         }
    };

    // add to command history
    function CLI__addHistory(cmd) {
        this.history.push(cmd);
        this.hlen++;
        this.hindex = this.hlen;
    }

    // cycle through command history
    function CLI__moveHistory(dir) {
        var cmd;
        CLI.hindex = __clamp(CLI.hindex - dir, 0, this.hlen);
        if (CLI.hindex == this.hlen) { cmd = ''; }
        else { cmd = this.history[CLI.hindex]; }
        CLI.elemInput.value = cmd;
        return cmd;
    }

    // add cbs
    function CLI__addListener(event, fn, opt_context) {
        if (!(event in this.listeners)) { return false; }
        this.listeners[event].push({ fn:fn, context:opt_context });
        return this.listeners[event].length;
    }

    // remove cbs
    function CLI__removeListener(event, fn) {
        if (!(event in this.listeners)) { return false; }
        for (var i=0; i < this.listeners[event].length; i++) {
            if (this.listeners[event][i].fn == fn) {
                this.listeners[event].splice(i, 1);
                return true;
            }
        }
        return false;
    }

    // remove all cbs
    function CLI__removeAllListeners(event) {
        if (!(event in this.listeners)) { return false; }
        this.listeners[event].length = 0;
    }

    // event broadcast
    function __broadcastResEvent(response, agent_id) {
        var req_listeners = CLI.listeners['response'];
        for (var i=0; i < req_listeners.length; i++) {
            req_listeners[i].fn.call(req_listeners[i].context, response, agent_id);
        }
    }

    // command handler
    function CLI__runCommand(command) {
        //Parser.logging = true;
        
        // Make sure we got something
        if (!command) { return; }

        // Parse
        try { 
            var cur_request = null;
            var cmd_parsedata = __parse(command); 
            var cmd_agentid = cmd_parsedata.agent || 0;
            var cmd_requests = cmd_parsedata.requests;
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
        
        // Default the last request to accept json+html if no type is given
        if (!cmd_requests[cmd_requests.length - 1].accept) {
            cmd_requests[cmd_requests.length - 1].accept = 'application/html+json';
        }
            
        // Execute with piping
        var handleResponse = function(res) {
            // If failed, break the chain
            if (res.code >= 400 || res.code == 0) {
                // Chain broken, broadcast
                __broadcastResEvent(res, cmd_agentid);
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
                    // Chain complete, broadcast
                    __broadcastResEvent(res, cmd_agentid);
                    // Send to history
                    History.addEntry(command, res);
                }
            }
        };
        CLI.structure.dispatch((cur_request = cmd_requests.shift()), handleResponse);
    };

    // range clamp helper
    function __clamp(v, min, max) {
        if (v < min) { return min; }
        else if (v > max) { return max; }
        return v;
    }

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
        // command = [ agent ] request { content-type [ request ] } .
        // ================================================
        var agent = null, requests = [], curMimeType, defaultMethod = 'get';
        this.log = ((this.logging) ? (function() { console.log.apply(console,arguments); }) : (function() {}));
        this.log('>> Parsing:',this.buffer);
        // Read agent
        agent = this.readAgent();
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
        this.log('<< Finished parsing:', agent, requests);
        return { agent:agent, requests:requests };
    };
    Parser.readAgent = function() {
        // agent = token '>' .
        // ===================
        // read non spaces...
        var match = /^\s*(\S*)/.exec(this.buffer);
        if (match && />/.test(match[1])) { // check for the identifying angle bracket
            var match_parts = match[1].split('>');
            var agent = match_parts[0];
            this.moveBuffer(agent.length+1);
            this.log('Read agent:', agent);
            return agent;
        }
        return false;
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
        match = /^[\w\/\*.0-9\+]+/.exec(this.buffer);
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
        if (match && match[1].charAt(0) != '[') { // dont match a pipe
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
