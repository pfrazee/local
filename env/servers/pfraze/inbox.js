define(['link'], function(Link) {
    // Inbox Server
    // ============
    // delivers a simple inbox
    // configuration =
    // {
    //   services: [ { name:..., uri:... }, ... ],
    // }
    var InboxServer = function(structure, config) {
        this.structure = structure;
        this.uri = config.uri;
        this.services = config.services;
        // Prep the structure
        for (var i=0; i < this.services.length; i++) {
            this.services[i].messagesLink = { method:'get', uri:this.services[i].uri, accept:'application/json' };
        }
    };
    InboxServer.prototype.routes = [
        Link.route('serve', { uri:'^/?$', method:'get', accept:/application\/html\+json/i })
    ];
    InboxServer.prototype.serve = function() {
        var body = {
            _scripts:{ onload:setupAgent },
            _data:{ services:this.services, uri:this.uri }
        }; 
        return Link.response(200, body, 'application/html+json');
    };

    // Agent Server
    // ============
    // serves for an inbox instance
    var AgentServer = function(agent) {
        this.agent = agent;
        this.messages = [];
    };
    AgentServer.prototype.routes = [
        Link.route('servMsg', { uri:'^/([0-9]+)/?$' }),
        Link.route('servMsgRange', { uri:'^/([0-9]+)\-([0-9]+)/?$' }),
        Link.route('servAll', { uri:'^/all/?$' }),
        Link.route('servChecked', { uri:'^/checked/?$' }),
        Link.route('servRead', { uri:'^/read/?' }),
        Link.route('servUnread', { uri:'^/unread/?' })
    ];
    AgentServer.prototype.runMethod = function(ids, request) {
        var f = request.method + 'Method';
        if (f in this) {
            return this[f](ids, request);
        } else {
            return Link.response(405);
        }
    };
    // Resources
    AgentServer.prototype.servMsg = function(request, match) {
        var i = +match.uri[1] - 1;
        return this.runMethod([i], request);
    };
    AgentServer.prototype.servMsgRange = function(request, match) {
        var low = +match.uri[1] - 1, high = +match.uri[2];
        var range = [];
        for (var i=low; i < high; i++) { range.push(i); }
        return this.runMethod(range, request);
    };
    AgentServer.prototype.servAll = function(request) {
        var range = [];
        for (var i=0; i < this.messages.length; i++) { range.push(i); }
        return this.runMethod(range, request);
    };
    AgentServer.prototype.servChecked = function(request) {
        var checkboxes = this.agent.getBody().getElementsByClassName('msg-checkbox');
        var ids = [];
        Array.prototype.forEach.call(checkboxes, function(c, i) {
            if (c.checked) { ids.push(i); }
        });
        return this.runMethod(ids, request);
    };
    AgentServer.prototype.servRead = function(request) {
        var ids = [];
        this.messages.forEach(function(m, i) {
            if (m.flags && m.flags.seen) { ids.push(i); }
        });
        return this.runMethod(ids, request);
    };
    AgentServer.prototype.servUnread = function(request) {
        var ids = [];
        this.messages.forEach(function(m, i) {
            if (m.flags && !m.flags.seen) { ids.push(i); }
        });
        return this.runMethod(ids, request);
    };
    // Methods
    AgentServer.prototype.getMethod = function(ids, request) {
        if (ids.length > 1) {
            // :TODO: solve this
            return { code:501, reason:'unable to GET multiple messages at this time' };
        }
        var m = this.messages[ids[0]];
        if (!m) { return { code:404 }; }
        // pipe to source service
        return this.agent.dispatch({ method:'get', uri:m.uri, accept:request.accept });
    };
    AgentServer.prototype.ckMethod = function(ids) {
        var rows = this.agent.getBody().getElementsByTagName('tr');
        // figure out if some need to be checked, or all dechecked
        var should_check = false;
        ids.forEach(function(id) {
            var c = rows[id].getElementsByClassName('msg-checkbox')[0];
            if (!c.checked) {
                should_check = true;
            }
        });
        // update elems
        ids.forEach(function(id) {
            var c = rows[id].getElementsByClassName('msg-checkbox')[0];
            c.checked = should_check;
        });
        return Link.response(204);
    };
    AgentServer.prototype.mrMethod = function(ids) {
        var rows = this.agent.getBody().getElementsByTagName('tr');
        // mark read all given
        ids.forEach(function(id) {
            // update DOM
            var row = rows[id];
            row.className = row.className.replace('unread','');
            // send message
            var m = this.messages[id];
            m.flags.seen = true;
            this.agent.dispatch({ method:'put', uri:m.uri+'/flags', 'content-type':'application/json', body:{ seen:1 } });
        }, this);
        return Link.response(204);
    };
    AgentServer.prototype.muMethod = function(ids) {
        var rows = this.agent.getBody().getElementsByTagName('tr');
        // mark read all given
        ids.forEach(function(id) {
            // update DOM
            var row = rows[id];
            if (/unread/i.test(row.className) == false) {
                row.className += 'unread';
            }
            // send message
            var m = this.messages[id];
            m.flags.seen = false;
            this.agent.dispatch({ method:'put', uri:m.uri+'/flags', 'content-type':'application/json', body:{ seen:0 } });
        }, this);
        return Link.response(204);
    };
    AgentServer.prototype.deleteMethod = function(ids) {
        var rows = this.agent.getBody().getElementsByTagName('tr');
        // delete all given
        ids.forEach(function(id) {
            // clear DOM
            var row = rows[id];
            row.innerHTML = '';
            // send delete message
            var m = this.messages[id];
            this.agent.dispatch({ method:'delete', uri:m.uri, accept:'application/json' });
            // clear out entry in messages
            this.messages[id] = null;
            // :TODO: notify user of success?
        }, this);
        return Link.response(204);
    };

    // Agent Client
    // ============
    // client-side functions
    function setupAgent(agent, response) {
        try { 
            // grab params
            var uri = response.body._data.uri;
            var services = response.body._data.services;
        } catch(e) { throw "malformed response body"; }

        // setup agent
        agent.attachServer(new AgentServer(agent));
        var server = agent.getServer();

        // get messages from all services
        services.forEach(function(service) {
            agent.dispatch(service.messagesLink).then(function(response) {
                if (response.code == 200) {
                    // cache
                    service.messages = response.body.messages;
                    for (var i=0; i < service.messages.length; i++) { service.messages[i].service = service.name; } // kind of sucks
                    server.messages = server.messages.concat(service.messages);
                    // render
                    render(agent, server.messages);
                }
            });
        });
    }
    function render(agent, messages) {
        var html = '';
        var body = agent.getBody();

        messages.sort(function(a,b) { return ((new Date(a.date).getTime() < new Date(b.date).getTime()) ? 1 : -1); });

        // styles
        html += '<style>';
        html += 'table.inbox tr.unread a { color:black }';
        html += 'table.inbox tr a { color:gray }';
        html += '</style>';

        // toolbar
        html += '<div style="height:35px">';
        html += '<form action="'+agent.getUri()+'/checked"><span class="btn-group">';
        html += '<button class="btn tool-select" title="check '+agent.getUri()+'/all" formmethod="ck" formaction="'+agent.getUri()+'/all"><i class="icon-check"></i> ck</button>';
        html += '</span><span class="btn-group" style="display:inline-block">';
        html += '<button class="btn tool-markread" title="mark as read '+agent.getUri()+'/checked" formmethod="mr"><i class="icon-eye-open"></i> mr</button>';
        html += '<button class="btn tool-markunread" title="mark unread '+agent.getUri()+'/checked" formmethod="mu"><i class="icon-eye-close"></i> mu</button>';
        html += '<button class="btn tool-delete" title="delete '+agent.getUri()+'/checked" formmethod="delete"><i class="icon-trash" formmethod="delete"></i> delete</button>';
        html += '</span></form>';
        html += '</div>';

        // messages
        html += '<table class="table table-condensed inbox">';
        messages.forEach(function(m, i) {
            var date = new Date(m.date);
            var md = (date.getMonth()+1)+'/'+date.getDate()+'&nbsp;'+date.getHours()+':'+(date.getMinutes() < 10 ? '0' : '')+date.getMinutes();
            var trclass = (m.flags && !m.flags.seen ? 'unread' : '');
            html += '<tr class="'+trclass+'"><td style="color:gray">'+(i+1)+'</td><td><input class="msg-checkbox" type="checkbox" /></td><td><span class="label">'+m.service+'</span></td><td><a href="'+m.uri+'">'+m.summary+'</a></td><td><span style="color:gray">'+md+'</span></td></tr>';
        });
        html += '</table>';

        // add to DOM
        body.innerHTML = html;
    }

    return InboxServer;
});
