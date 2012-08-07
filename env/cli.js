/*
Example:
  apps/foo [ json ] post --pragma="no-cache" convert [ xml ] post apps/bar

command      = [ agent ] request [ content-type ] .
agent        = token '>' .
request      = [ method ] uri { header-flag } .
header-flag  = [ "-" | "--" ] header-key "=" header-value .
content-type = "[" token "]" .
method       = token .
header-key   = token .
header-value = token | string .
string       = '"' { token } '"' .
*/
define(['link', 'env/env'], function(Link, Env) {
    // CLI
    // ===
    // Parses a command syntax into Link requests 
    // :TODO: change command history to command...buffer, I dunno. It conflicts with the request history
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
    function CLI__init(elem_id) {
        // init attributes
        this.elemInput = document.getElementById(elem_id);
        this.elemInput.onkeydown = __clikeydown;
        this.listeners = {
            request:[]
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
                e.preventDefault(); // dont let it move the cursor to the start of the line
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
    function __broadcast(event, params) {
        var listeners = CLI.listeners[event];
        for (var i=0; i < listeners.length; i++) {
            listeners[i].fn.apply(listeners[i].context, params);
        }
    }

    // command handler
    function CLI__runCommand(command) {
        //Parser.logging = true;
        
        // make sure we got something
        if (!command) { return; }

        // parse
        try { 
            var cur_request = null;
            var cmd = __parse(command); 
        } catch(e) {
            // Add to history
            var res = Link.response(400, 0, 0, { reason:e.toString() });
            return;
        }

        // defaults
        cmd.agent = cmd.agent || '.';
        cmd.request.method = cmd.request.method || 'get';
        cmd.request.accept = cmd.request.accept || 'application/html+json';

        // broadcast
        __broadcast.call(this, 'request', [cmd.request, cmd.agent, command]);
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
        // command = [ agent ] request [ request ] .
        // ================================================
        this.log = ((this.logging) ? (function() { console.log.apply(console,arguments); }) : (function() {}));
        this.log('>> Parsing:',this.buffer);

        var agent = this.readAgent();

        var request = this.readRequest();
        if (!request) { throw "Expected request"; }

        request.accept = this.readContentType();    

        this.log('<< Finished parsing:', agent, request);
        return { agent:agent, request:request };
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
