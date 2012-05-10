define(function() {
    var History = function(cli_uri) {
        this.cli_uri = cli_uri;
        this.history = [];
    };

    // Routes
    // ======
    History.prototype.routes = [
        { cb:"listener", uri:".*", bubble:true },
        { cb:"listHandler", uri:"^hist/?$", method:"get", accept:"text/html" },
        { cb:"addEntryHandler", uri:"^hist/?$", method:"post", "content-type":"js/object", accept:"text/html" },
        { cb:"getEntryHandler", uri:'^hist/([0-9]+)/?$', method:'get' }
    ];

    // Handlers
    // ========
    History.prototype.listener = function(request, response, match) {
        var entry = { response:response };
        // If sent through the command line
        if (request.uri == this.cli_uri && request.method == 'post') {
            // Use the command
            entry.cmd = request.body.cmd;
            if (!entry.cmd) { entry.cmd = ''; }
        } else {
            // Natural request, make sure not something from the cli
            if (request.cli) { return response; }
            // Use the uri as the command
            if (request.method == 'get') {
                entry.cmd = request.uri;
            } else {
                entry.cmd = request.method + ' ' + request.uri;
            }
        }
        // Add to histry
        this.history.push(entry);
        document.getElementById('lshui-hist').innerHTML = this.renderHtml();
        // Allow to be processed
        return response;
    };
    History.prototype.listHandler = function() {
        return { code:200, body:this.renderHtml(), 'content-type':'text/html' };
    };
    History.prototype.addEntryHandler = function(request) {
        this.history.push(request.body);
        return { code:200, body:this.renderHtml(), 'content-type':'text/html' };
    };
    History.prototype.getEntryHandler = function(request, response, match) {
        var index = match.uri[1];
        var entry = this.history[index-1];
        if (!entry) { return { code:404, reason:'not found' }; }
        if (!entry.response) { return { code:204 }; }
        return { code:200, body:entry.response.body, 'content-type':entry.response['content-type'] };
    };

    // Helpers
    // =======
    History.prototype.renderHtml = function() {
        var html=[];
        for (var i=this.history.length; i > 0; i--) {
            var entry = this.history[i-1];
            var response = entry.response || { code:404, reason:'not found' };
            html.push('<div>');
            // command
            html.push('<p>&rsaquo;'+entry.cmd+'</p>');
            // code
            var isok = (response.code >= 200 && response.code < 400);
            html.push('<p><span class="' + (isok ? 'good' : 'bad') + '">' + response.code + '</span>');
            // reason phrase
            var reason = response.reason;
            if (!reason) {
                if (isok) { reason = 'ok'; }
                else {
                    if (response.code >= 500) { reason = 'err'; }
                    else if (response.code >= 400) { reason = 'invalid'; }
                }
            }
            html.push(' ' + reason + ' ');
            // history
            var uri = this.uri + 'hist/' + i;
            html.push('<a href="' + uri + '">\'' + uri + '\'</a></p>');
            html.push('</div>');
        }
        return html.join('');
    };

    

    return History;
});