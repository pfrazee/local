define(['link'], function(Link, Views) {
    // Inbox Service Fixture
    // =====================
    // Provides static debug data
    var FixtureService = function(structure, config) {
        this.serviceName = 'Fixture';
        this.uri = config.uri;
        // fixture data
        this.messages = [
            { date:'July 23 2012 21:20', author:'rodger', recp:['bsmith'], subject:'Hey, Buddy!', body:'How are you doing?', re:null },
            { date:'August 1 2012 12:49', author:'bsmith', recp:['bsmith', 'asmitherson'], subject:'About the meeting', body:'Important business conversation. Things people talk about and stuff', re:null },
            { date:'August 5 2012 18:12', author:'asmitherson', recp:['bsmith', 'asmitherson'], subject:'RE: About the meeting', body:'Other stuff about business or whatever.', re:2 }
        ];
    };
    
    // Handler Routes
    // ==============
    FixtureService.prototype.routes = [
        Link.route('messagesHandler', { uri:'^/?$', accept:'json' }),
        Link.route('messageHtmlHandler', { uri:'^/([0-9]+)/?$', accept:'html' })
    ];
    FixtureService.prototype.messagesHandler = function(request) {
        // Collect messages
        var retMessages = [];
        for (var i=0; i < this.messages.length; i++) {
            var message = this.messages[i];
            retMessages.push({
                id:i,
                service:this.serviceName,
                date:message.date,
                summary:'<strong>' + message.author + '</strong> ' + message.subject,
                uri:this.uri + '/' + i
            });
        }
        return Link.response(200, { messages:retMessages }, 'application/json');
    };    
    FixtureService.prototype.messageHtmlHandler = function(request, match) {
        // Find message
        var message = this.messages[match.uri[1]];
        if (!message) { return Link.response(404); }
        // Build html
        var recp = [];
        for (var i=0; i < message.recp.length; i++) { 
            recp.push('<span class="label">'+message.recp[i]+'</span>');
        }
        var date = new Date(message.date).toLocaleDateString();
        var time = new Date(message.date).toLocaleTimeString();
        var html = ''; 
        html += '<h3 style="margin-bottom:5px">'+message.subject+'</h3>';
        html += '<p><small>Sent on <span class="label">'+date+' @'+time+'</span> ';
        html += 'by <span class="label">'+message.author+'</span> ';
        html += 'to '+recp.join(',')+'</small></p><hr/>';
        html += '<p>'+message.body+'</p>'
        return Link.response(200, html, 'text/html');
    };

    // Helpers
    // =======
    function __mkInboxResp(messages) {
        return {
            _scripts:{ onrender:__inboxRespRender },
            _data:{ messages:messages, uri:this.uri },
            childNodes:['<table class="table table-condensed"></table>']
        };
    }
    function __inboxRespRender(elem, env) {
        if (!this._data.messages) { return; }
        var table = elem.getElementsByTagName('table')[0];
        if (!table) { throw "<table> not found"; }
        // Render to html
        var html = '';
        for (var i=0; i < this._data.messages.length; i++) {
            var m = this._data.messages[i];
            var md = new Date(m.date).toLocaleDateString() + ' @' + new Date(m.date).toLocaleTimeString();
            html += '<tr><td><span class="label">'+m.service+'</span></td><td><a href="'+m.view_link+'">'+m.summary+'</a></td><td>'+md+'</td></tr>';
        }
        // Add to DOM
        table.innerHTML = html;
    }
    
    return FixtureService;
});
