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
define(['link/module', 'link/app'], function(Module, app) {
    // CLI
    // ===
    // Run HTTP requests in the command line
    var CLI = Module({
        routes: [
            { cb:interfaceHandler, uri:'^/?$', method:'get', accept:'text/html' },
            { cb:commandHandler, uri:'^/?$', method:'post', contenttype:'text/plain' },
            { cb:historyEntryHandler, uri:'^/([0-9]+)/?$', method:'get' },
            { cb:historyCommand, uri: '^/history/?$', method:'get', accept:'text/html' },
            { cb:echoCommand, uri: '^/echo/?$', method:'post' },
            { cb:testCommand, uri: '^/test/?$', method:'get', accept:'text/html' }
        ],
        history:[]
    });

    // Route handlers
    // ==============
    CLI.prototype.interfaceHandler = function(request) {
        // Respond withq interface
        return {
            code:200,
            body: [
                '<div>',
                '<div id="cli-out" style="height:300px; overflow-y:scroll"></div>',
                '<div><input id="cli-in" type="text" class="span8" /></div>'
            ].join(''),
            contenttype:'text/html'
        };
        
        // Register handlers
        // :TODO: need a new way to do this
        /*var self = this;
        var cliIn = document.getElementById('cli-in');
        var cliOut = document.getElementById('cli-out');
        cliIn.onkeydown = function(e) {
            if (e.which == 13) { // enter key
                // Submit to execute
                var cmd = cliIn.value;
                var request = new Request('post', self.uri(), { accept:'text/html' }, cmd, 'text/plain');
                request.dispatch(function(request, response) {
                    // Add response
                    cliOut.innerHTML += response.body();
                    cliOut.scrollTop = 1000000;
                    cliIn.value = '';
                });
            }
        };*/
    };
    CLI.prototype.commandHandler = function(request) {
        //this.parser.logging = true;
        var self = this;
        var cmd = request.body;
        if (!cmd) { return { code:200 }; }
        var cmdResponses = [];
        var promise = _.makePromise();

        // Dispatch helper
        var dispatch = function(req, handler) {
            // If not given a pound-sign or a schema, make the URI relative to our URI
            if (req.uri.charAt(0) != '#' && !/^[\w]+\:\/\//i.test(req.uri)) {
                req.uri = self.uri + '/' + req.uri;
            }
            req.pragma = 'partial';
            app.dispatch(req, handler);
        };
        // Response helper
        var respond = function() {
            var finalResponse = (cmdResponses.length ? cmdResponses[cmdResponses.length - 1] : null);
            var histId = self.addHistory(cmd, cmdResponses);
            var histUri = self.uri + '/' + histId;
            
            // Html response
            if (request.accept == 'text/html') {
                var msg = '' + finalResponse.code;
                // Add reason if a fail
                if (finalResponse.code >= 300) {
                    if (finalResponse.reason) { msg += ' ' + finalResponse.reason; }
                }
                // Add response URI(s)
                if (cmdResponses.length > 1) {
                    for (var i=1; i <= cmdResponses.length; i++) {
                        msg += ' <a href="' + histUri + '/' + i + '">' + histUri + '/' + i + '</a>';
                    }
                } else {
                    msg += ' <a href="' + histUri + '">' + histUri + '</a>';
                }
                var output = self.history[histId-1].output = [
                    '<p>',
                    '<span class="label">', (new Date()).toLocaleTimeString(), '</span> ',
                    '<strong>',cmd,'</strong>',
                    '</p>',
                    '<p>',(finalResponse.code < 300 ? '&check; ' : '&times; ' ), msg,'</p>'
                ].join('');
                // Respond
                promise.fulfill({ code:200, body:output, contenttype:'text/html' });
            } else {
                promise.fulfill({ code:200 });
            }
        };
            
        // Parse
        try {
            var cmdRequests = self.parse(cmd);
        } catch(e) {
            cmdResponses.push({ code:400, body:e });
            return respond();
        }
            
        // Execute with piping
        var reqOne = cmdRequests.shift();
        var handleResponse = function(res) {
            // Store the response
            console.log(cmd, res);
            cmdResponses.push(res);
            // If failed, break the chain and respond now
            if (res.code >= 300) {
                respond();
            } else {
                // Succeeded, continue the chain
                if (cmdRequests.length) {
                    var nextReq = cmdRequests.shift();
                    nextReq.body = res.body;
                    dispatch(nextReq, handleResponse);
                } else {
                    // No more, respond
                    respond();
                }
            }
        };
        dispatch(reqOne, handleResponse);
        return promise;
    };
    CLI.prototype.historyEntryHandler = function(request, response, urimatch) {
        var histIndex = urimatch[1] - 1;
        
        // Get & validate
        var hist = this.history[histIndex];
        if (!hist) { return { code:404, body:'history entry not found' }; }
        var resp = hist.finalResponse;
        if (request.accept && resp.contenttype != request.accept) {
            return { code:415, body:'media type mismatch (' + resp.contenttype + ' &rarr; ' + request.accept + ')' };
        }

        // Respond
        // :TODO: deep copy
        return _.clone(resp);
    };

    // Helpers
    // =======
    CLI.prototype.addHistory = function(cmd, responses) {
        this.history.push({
            cmd:cmd,
            responses:responses,
            finalResponse:responses[responses.length - 1]
        });
        return this.history.length; // use 1-based IDs for history
    };

    // Commands
    // ========
    CLI.prototype.historyCommand = function(request) {
        var html = '';
        for (var i=0; i < this.history.length; i++) {
            html += this.history[i].output;
        }
        return { code:200, body:html, contenttype:'text/html' };
    }
    CLI.prototype.echoCommand = function(request) {
        if (request.body) {
            var elem = document.getElementById('cli-out');
            elem.innerHTML += request.body;
            elem.scrollTop = 100000;
        }
        return { code:200 }
    };
    
    // Testing
    // =======
    CLI.prototype.testsResource = function(orgRequest) {        
        // :TODO: log query param
        //this.parser.logging = true;

        // Start a new test suite
        var self = this;
        (new Request('post', '#/test/suite', {}, 'Parser')).dispatch(function(request, response) {
            // Set up requests
            var suiteURI = '#/test/suite/' + response.body() + '/';
            var test = Request.Factory('post', [suiteURI,0], { 'content-type':'jso/array' });
            var tests = [];
            var testParse = function(cmd, match) {
                var requests = self.parse(cmd);
                tests.push(test('matches', [requests, match]).header('message', 'parse of ' + cmd));
            };
            
            // Build test suite
            testParse('a', [
                { uri:'a', method:'get' }
            ]);
            testParse('a/b/c', [
                { uri:'a/b/c', method:'get' }
            ]);
            testParse('#a/b/c', [
                { uri:'#a/b/c', method:'get' }
            ]);
            testParse('http://google.com', [
                { uri:'http://google.com', method:'get' }
            ]);
            testParse('post a/b/c', [
                { uri:'a/b/c', method:'post' }
            ]);
            testParse('post #a/b/c', [
                { uri:'#a/b/c', method:'post' }
            ]);
            testParse('post http://google.com', [
                { uri:'http://google.com', method:'post' }
            ]);
            testParse('put a/b/c --pragma=test', [
                { uri:'a/b/c', method:'put', pragma:'test' }
            ]);
            testParse('put a/b/c --pragma="test"', [
                { uri:'a/b/c', method:'put', pragma:'test' }
            ]);
            testParse('put a/b/c --pragma=test --key=value', [
                { uri:'a/b/c', method:'put', pragma:'test', key:'value' }
            ]);
            testParse('a [b]', [
                { uri:'a', method:'get', accept:'b' }
            ]);
            testParse('a [b/c]', [
                { uri:'a', method:'get', accept:'b/c' }
            ]);
            testParse('a [ b/c ]', [
                { uri:'a', method:'get', accept:'b/c' }
            ]);
            testParse('a [ b/c ] d', [
                { uri:'a', method:'get', accept:'b/c' },
                { uri:'d', method:'post', 'content-type':'b/c' }
            ]);
            testParse('a/b [ c/d ] e/f', [
                { uri:'a/b', method:'get', accept:'c/d' },
                { uri:'e/f', method:'post', 'content-type':'c/d' }
            ]);
            testParse('a/b [ c/d ] e/f [g/h] i/j', [
                { uri:'a/b', method:'get', accept:'c/d' },
                { uri:'e/f', method:'post', 'content-type':'c/d', 'accept':'g/h' },
                { uri:'i/j', method:'post', 'content-type':'g/h' }
            ]);
            testParse('get a/b [ c/d ] put e/f', [
                { uri:'a/b', method:'get', accept:'c/d' },
                { uri:'e/f', method:'put', 'content-type':'c/d' }
            ]);
            testParse('get a/b --c=d --e="f" [ g/h ] put i/j --k=l', [
                { uri:'a/b', method:'get', accept:'g/h', c:'d', e:'f' },
                { uri:'i/j', method:'put', 'content-type':'g/h', k:'l'  }
            ]);

            // Send to process
            Request.batchDispatch(tests, null, function() {
                // Respond with report
                var getTestReport = new Request('get', suiteURI, { accept:'text/html', pragma:'partial' });
                getTestReport.pipeTo(orgRequest);
            });
        });
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
            if (!request.method()) {
                request.method(defaultMethod);
                this.log('Set request to default: ', defaultMethod);
            }
            
            // If previously given a mimetype, use it to describe the body of this request
            if (curMimeType) {
                request.header('content-type', curMimeType);
                this.log('Set content-type to ', curMimeType);
            }
            
            // Add to chain
            requests.push(request);
            
            // Read content type
            curMimeType = this.readContentType();

            // Use to describe the expected response body
            if (curMimeType) {
                requests[requests.length - 1].header('accept', curMimeType);
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
        var request = new Request(method, targetUri, headers);
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