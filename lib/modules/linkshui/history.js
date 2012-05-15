define(function() {
    var History = function() {
        this.history = [];
    };

    // Routes
    // ======
    History.prototype.routes = [
        { cb:"listHandler", uri:"^/?$", method:"get", accept:"text/html" },
        { cb:"addEntryHandler", uri:"^/?$", method:"post", "content-type":"js/object" },
        { cb:"getEntryHandler", uri:'^([0-9]+)/?$', method:'get' }
    ];

    // Handlers
    // ========
    History.prototype.listHandler = function() {
        return { code:200, body:this.renderHtml(), 'content-type':'text/html' };
    };
    History.prototype.addEntryHandler = function(request) {
        // validate
        if (!request.body.cmd) { return { code:400, reason:'cmd is required' }; }
        if (!request.body.response) { return { code:400, reason:'response is required' }; }
        // add
        this.history.push({
            cmd:request.body.cmd,
            response:request.body.response
        });
        return { code:200 };
    };
    History.prototype.getEntryHandler = function(request, response, match) {
        // :TODO: make this behave better-- response in body, js/object content type
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
            var isok = (response.code >= 200 && response.code < 400);
            html.push('<div>');
            // command
            html.push('<p>&rsaquo;'+entry.cmd+'</p>');
            // code
            html.push('<div><p class="right">');
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
            html.push('<span class="' + (isok ? 'good' : 'bad') + '">' + response.code + '</span>');
            // history
            var uri = this.uri + 'hist/' + i;
            //html.push('<a href="' + uri + '">\'' + uri + '\'</a></p>');
            html.push('</div><br />');
        }
        return html.join('');
    };

    

    return History;
});