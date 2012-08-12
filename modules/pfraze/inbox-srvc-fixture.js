define(['link'], function(Link, Views) {
    // Inbox Service Fixture
    // =====================
    // Provides static debug data
    var FixtureService = function(structure, config) {
        this.serviceName = 'Fixture';
        this.uri = config.uri;
        // fixture data
        this.messages = [
            { date:'July 23 2012 21:20', author:'rodger', recp:['bsmith'], subject:'Hey, Buddy!', body:'How are you doing?', flags:{ seen:1 } },
            { date:'August 1 2012 12:49', author:'bsmith', recp:['bsmith', 'asmitherson'], subject:'About the meeting', body:'Important business conversation. Things people talk about and stuff', flags:{ seen:1 } },
            { date:'August 5 2012 18:12', author:'asmitherson', recp:['bsmith', 'asmitherson'], subject:'RE: About the meeting', body:'Other stuff about business or whatever.', flags:{ seen:0 } }
        ];
    };
    
    // Handler Routes
    // ==============
    FixtureService.prototype.routes = [
        Link.route('manyMessageGetJson', { method:'get', uri:'^/?$', accept:'application/json' }),
        Link.route('oneMessageGetHtmljson', { method:'get', uri:'^/([0-9]+)/?$', accept:/application\/html\+json/ }),
        Link.route('oneFlagsPutJson', { method:'put', uri:'^/([0-9]+)/flags/?$', 'content-type':'application/json' }),
        Link.route('composeGetHtmljson', { method:'get', uri:'^/new/?$', accept:/application\/html\+json/ })
    ];
    FixtureService.prototype.manyMessageGetJson = function(request) {
        // Collect messages
        var retMessages = [];
        this.messages.forEach(function(message, i) {
            retMessages.push({
                id:i,
                service:this.serviceName,
                date:message.date,
                summary:'<strong>' + message.author + '</strong> ' + message.subject,
                uri:this.uri + '/' + i,
                flags:message.flags
            });
        }, this);
        return Link.response(200, { messages:retMessages }, 'application/json');
    };    
    FixtureService.prototype.oneMessageGetHtmljson = function(request, match) {
        // Find message
        var message = this.messages[match.uri[1]];
        if (!message) { return { code:404, reason:'not found' }; }
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
        html += '<p>'+message.body+'</p>';
        return Link.response(200, { childNodes:[html] }, 'application/html+json');
    };
    FixtureService.prototype.oneFlagsPutJson = function(request, match) {
        // Find message
        var message = this.messages[match.uri[1]];
        if (!message) { return { code:404, reason:'not found' }; }
        // Validate body
        if (!request.body) { return { code:400, reason:'body required' }; }
        // Update flags
        if (typeof request.body.seen != 'undefined') {
            message.flags.seen = request.body.seen;
        }
        return { code:200 };
    }
    FixtureService.prototype.composeGetHtmljson = function(request) {
        return Link.response(200, { childNodes:['<p>This would be a nice place to write a message</p>'] }, 'application/html+json');
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
