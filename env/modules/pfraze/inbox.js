define(['link'], function(Link) {
    // Inbox Module
    // ============
    // pulls messages from multiple services and renders them in an inbox GUI
    var Inbox = function(structure, config) {
        this.structure = structure;
        this.uri = config.uri;
        this.services = config.services;
        // Prep the structure
        for (var i=0; i < this.services.length; i++) {
            this.services[i].messagesLink = { uri:this.services[i].uri, accept:'application/json' };
        }
    };

    // Handler Routes
    // ==============
    Inbox.prototype.routes = [
        Link.route('mainInbox', { uri:'^/?$', method:'get', accept:'html' }),
        Link.route('serviceInbox', { uri:'^/services/([^/]+)/?$', method:'get', accept:'html' })
    ];

    // Resource Handlers
    // =================
    Inbox.prototype.mainInbox = function _mainInbox() {
        // Promise to respond after the services all sync
        var promise = new Link.Promise();
        var responsesLeft = 0;
        // Get messages from all services
        var allMessages = [];
        for (var i=0; i < this.services.length; i++) {
            responsesLeft++;
            // Capture the service in a closure
            (function(self, service) {
                self.structure.get(service.messagesLink).then(function(response) {
                    // Cache
                    if (response.code == 200) {
                        service.messages = response.body.messages;
                        // :HACK: make this more efficient
                        for (var i=0; i < service.messages.length; i++) { service.messages[i].service = service.name; }
                        allMessages = allMessages.concat(service.messages);
                    }
                    if (--responsesLeft == 0) {
                        // Render response
                        var body = __mkInboxResp.call(this, allMessages);
                        promise.fulfill(Link.response(200, body, 'application/html+json'));
                    }
                }, self);
            })(this, this.services[i]);
        }
        if (responsesLeft == 0) { return Link.response(204); }
        return promise;
    };
    Inbox.prototype.serviceInbox = function _serviceInbox(request, match) {
        // Get the service
        var sk = parseInt(match.uri[1]);
        var service = this.services[sk];
        if (!service) { return Link.response(404); }
        
        // Dispatch for messages
        var promise = new Link.Promise();
        this.structure.get(service.messagesLink).then(function(response) {
            // Cache
            if (response.code == 200) { this.messages = response.body; }
            // Render & respond
            var body = __mkInboxResp.call(this, this.messages);
            promise.fulfill(Link.response(200, body, 'application/html+json'));
        }, service);
        return promise;
    };

    // Helpers
    // =======
    function __mkInboxResp(messages) {
        return {
            _scripts:{ load:__inboxRespLoad },
            _data:{ messages:messages, uri:this.uri }
        };
    }
    function __inboxRespLoad(elem, env) {
        if (!this._data.messages) { return; }
        // Sort by date
        this._data.messages.sort(function(a,b) { return ((new Date(a.date).getTime() < new Date(b.date).getTime()) ? 1 : -1); });
        // Render to html
        var html = '<table class="table table-condensed">';
        for (var i=0; i < this._data.messages.length; i++) {
            var m = this._data.messages[i];
            var md = new Date(m.date).toLocaleDateString() + ' @' + new Date(m.date).toLocaleTimeString();
            html += '<tr><td><span class="label">'+m.service+'</span></td><td><a href="'+m.URIself+'">'+m.summary+'</a></td><td>'+md+'</td></tr>';
        }
        html += '</table>';
        // Add to DOM
        elem.innerHTML = html;
    }

    return Inbox;
});
