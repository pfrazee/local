define(function() {
    // Maintains command history
    var History = {
        entries:[],
        history_elem:null,
        init:__init,
        addEntry:__addEntry,
        redraw:__redraw
    };

    // Operations
    function __init(history_elem_id) {
        this.history_elem = document.getElementById(history_elem_id);
    }

    function __addEntry(cmd, response) {
        var entry = {
            cmd:cmd,
            response:response
        };
        this.entries.push(entry);
        this.history_elem.innerHTML = __toHtml(entry) + this.history_elem.innerHTML;
    } 

    function __redraw() {
        var html = [];
        for (var i=0; i < this.entries.length; i++) {
            html.push(__toHtml(this.entries[i]));
        }
        this.history_elem.innerHTML = html.join('');
    }

    // Helpers
    var __toHtml = function(entry) {
        var html=[];
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
        return html.join('');
    };

    return History;
});
