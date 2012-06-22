define(['link'], function() {
    var History = function() {
        this.history = [];
    };

    // Resource Meta
    // =============
    var RootResource = {
        desc:'Linkshui CLI History.',
        _get:'Provides an array of the stored entries.',
        _post:{
            desc:'Adds an entry to the history.',
            validate:function(request) {
                if (!request.body) { throw { code:400, reason:"Body of type js/object is required." }; }
                if (typeof request.body != 'object') { throw { code:400, reason:"Body of type js/object is required." }; }
                if (!request.body.cmd) { throw { code:400, reason:"`cmd` key must specify the command used to invoke the entry." }; }
                if (!request.body.response) { throw { code:400, reason:"`response` key must specify the final response to the command." }; }
            }
        }
    };
    var EntryResource = {
        desc:'History entry.',
        _get:'Provides the history entry.'
    };
    // initial resources
    History.prototype.resources = {
        '/':RootResource,
        // /[0-9]+:EntryResource
    };
    
    // Routes
    // ======
    History.prototype.routes = {
        listHandler:{ uri:"^/?$", method:"get" },
        addEntryHandler:{ uri:"^/?$", method:"post" },
        getEntryHandler:{ uri:'^/([0-9]+)/?$', method:'get' }
    };
    
    // Handlers
    // ========
    History.prototype.listHandler = function() {
        return { code:200, body:this.history, 'content-type':'js/lshui.hist+object' };
    };
    History.prototype.addEntryHandler = function(request) {
        this.history.push({
            cmd:request.body.cmd,
            response:request.body.response
        });
        this.resources['/' + this.history.length] = EntryResource;
        return { code:200 };
    };
    History.prototype.getEntryHandler = function(request, match) {
        var entry = this.history[(+match.uri[1])-1]; // convert to number, then 0-based
        if (!entry) { return { code:404, reason:'not found' }; }
        if (!entry.response) { return { code:204 }; }
        return { code:200, body:entry.response.body, 'content-type':entry.response['content-type'] };
    };

    // Type interfaces
    // ===============
    Link.addToType('js/lshui.hist+object', {
        toHtml:function() {
            var html=[];
            for (var i=this.data.length; i > 0; i--) {
                var entry = this.data[i-1];
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
        }
    });

    return History;
});