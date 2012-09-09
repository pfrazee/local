/*
:DEPRECATED: kept here for possible use later

Example:
  agent> get apps/foo [application/html+json]

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
define(['link', './env', './event-emitter'], function(Link, Env, EventEmitter) {
    // CLI
    // ===
    // Parses a command syntax into Link requests 
    var CLI = {
        init:CLI__init,
        runCommand:CLI__runCommand,
    };
    EventEmitter.mixin(CLI);
    
    // setup func    
    function CLI__init() {
        /* :NOTE: this CLI is the skeleton of legacy, reduced now to its parser.
         * The way it's built now, it keeps consumers from merely parsing the request.
         * Rather, it emits the request event. It's unclear if the protection or
         * abstraction still serves any purpose. Should the decision of how a parsed
         * command should be executed be available to the caller?
         * :TODO: refactor if yes
         */
    };

    // command handler
    function CLI__runCommand(agent, command) {
        //Parser.logging = true;
        
        // make sure we got something
        if (!command) { return; }

        // parse
        try { 
            var cur_request = null;
            var cmd = CLI__parse(command); 
        } catch(e) {
            // Add to history
            var res = Link.response(400, 0, 0, { reason:e.toString() });
            return;
        }

        // defaults
        cmd.request.method = cmd.request.method || 'get';
        cmd.request.accept = cmd.request.accept || 'application/html+json';

        // broadcast
        this.emitEvent('request', cmd.request, cmd.agent);
    };

    // range clamp helper
    function __clamp(v, min, max) {
        if (v < min) { return min; }
        else if (v > max) { return max; }
        return v;
    }

    // Parser
    // ======
    function CLI__parse(buffer) {
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
