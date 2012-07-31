define(['link'], function(Link) {
    // Inbox Module
    // ============
    // generic messages inbox
    // configuration =
    // {
    //   services: [ { name:..., uri:... }, ... ],
    // }
    var Server = function(structure, config) {
        this.structure = structure;
        this.uri = config.uri;
        this.services = config.services;
        // Prep the structure
        for (var i=0; i < this.services.length; i++) {
            this.services[i].messagesLink = { method:'get', uri:this.services[i].uri, accept:'application/json' };
        }
    };
    Server.prototype.routes = [
        Link.route('serve', { uri:'^/?$', method:'get', accept:/application\/html\+json/i })
    ];
    Server.prototype.serve = function() {
        var body = {
            _scripts:{ onload:setupAgent },
            _data:{ services:this.services, uri:this.uri }
        }; 
        return Link.response(200, body, 'application/html+json');
    };

    // Agent
    // =====
    function setupAgent(agent, response) {
        try { 
            // grab params
            var uri = response.body._data.uri;
            var services = response.body._data.services;
        } catch(e) { throw "malformed response body"; }
        
        // get messages from all services
        var allMessages = [];
        services.forEach(function(service) {
            agent.dispatch(service.messagesLink).then(function(response) {
                if (response.code == 200) {
                    // cache
                    service.messages = response.body.messages;
                    for (var i=0; i < service.messages.length; i++) { service.messages[i].service = service.name; } // kind of sucks
                    allMessages = allMessages.concat(service.messages);
                    // render
                    render(agent, allMessages);
                }
            });
        });
    }
    function render(agent, messages) {
        // Sort by date
        messages.sort(function(a,b) { return ((new Date(a.date).getTime() < new Date(b.date).getTime()) ? 1 : -1); });
        // Render to html
        var html = '<table class="table table-condensed">';
        for (var i=0; i < messages.length; i++) {
            var m = messages[i];
            var md = new Date(m.date).toLocaleDateString() + ' @' + new Date(m.date).toLocaleTimeString();
            html += '<tr><td><span class="label">'+m.service+'</span></td><td><a href="'+m.uri+'">'+m.summary+'</a></td><td>'+md+'</td></tr>';
        }
        html += '</table>';
        // Add to DOM
        agent.getBody().innerHTML = html;
    }

    return Server;
});
