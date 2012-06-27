define(['link'], function() {
    var History = function() {
        this.history = [];
    };
    
    // Routes
    // ======
    History.prototype.routes = [
        Link.route('listObjHandler', { uri:"^/?$", method:"get" }),
        Link.route('listHtmlHandler', { uri:"^/?$", method:"get", accept:"html" }),
        Link.route('addEntryHandler', { uri:"^/?$", method:"post" }),
        Link.route('getEntryHandler', { uri:'^/([0-9]+)/?$', method:'get' })
    ];
    
    // Handlers
    // ========
    History.prototype.listObjHandler = function() {
        return Link.response(200, this.history, 'obj/lshui.hist');
    };
    History.prototype.listHtmlHandler = function(request, match, response) {
        response.body = __toHtml(response.body);
        response['content-type'] = 'text/html';
        return response;
    };
    History.prototype.addEntryHandler = function(request) {
        this.history.push({
            cmd:request.body.cmd,
            response:request.body.response
        });
        return Link.response(200);
    };
    History.prototype.getEntryHandler = function(request, match) {
        var entry = this.history[(+match.uri[1])-1]; // convert to number, then 0-based
        if (!entry) { return Link.response(404, 0,0, { reason:'not found' }); }
        if (!entry.response) { return Link.response(204); }
        return Link.response(200, entry.response.body, entry.response['content-type']);
    };

    // Helpers
    var __toHtml = function(history) {
        var html=[];
        for (var i=history.length; i > 0; i--) {
            var entry = history[i-1];
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
            // :TODO: history?
            //var uri = this.uri + 'hist/' + i;
            //html.push('<a href="' + uri + '">\'' + uri + '\'</a></p>');
            html.push('</div></div><br />');
        }
        return html.join('');
    };

    return History;
});