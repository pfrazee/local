define(['link'], function(Link, Views) {
    // Inbox Service Fixture
    // =====================
    // Provides static debug data
    var FixtureService = function(structure, config) {
        this.serviceName = 'Fixture';
        this.uri = config.uri;
        // fixture data
        this.messages = [
            { date:new Date('April 23 2012 21:20'), author:'rodger', recp:['bsmith'], subject:'Hey, Buddy!', body:'How are you doing?', re:null },
            { date:new Date('April 24 2012 12:49'), author:'bsmith', recp:['bsmith', 'asmitherson'], subject:'About the meeting', body:'Important business conversation. Things people talk about and stuff', re:null },
            { date:new Date('April 25 2012 15:12'), author:'asmitherson', recp:['bsmith', 'asmitherson'], subject:'RE: About the meeting', body:'Other stuff about business or whatever.', re:2 }
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
                view_link:this.uri + '/' + i
            });
        }
        return Link.response(200, retMessages, 'application/json');
    };    
    FixtureService.prototype.messageHtmlHandler = function(request, match) {
        // Find message
        var message = this.messages[match.uri[1]];
        if (!message) { return Link.response(404); }
        // Build html
        var messageView = 'todo'; 
        return Link.response(200, messageView.toString(), 'text/html');
    };

    return FixtureService;
});
