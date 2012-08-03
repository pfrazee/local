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
        var html = '';
        var body = agent.getBody();
        var links = agent.getLinks();

        messages.sort(function(a,b) { return ((new Date(a.date).getTime() < new Date(b.date).getTime()) ? 1 : -1); });

        // styles
        html += '<style>';
        html += 'table.inbox tr.unread a { color:black }';
        html += 'table.inbox tr a { color:gray }';
        html += '</style>';
        
        // toolbar
        html += '<div style="height:35px">';
        html += '<form method="post"><span class="btn-group">';
        html += '<button class="btn tool-select" title="select/deselect" formaction="'+agent.getUri()+'/ck"><i class="icon-check"></i> ck</button>';
        html += '</span><span class="btn-group" style="display:inline-block">';
        html += '<button class="btn tool-markread" title="mark as read" formaction="'+agent.getUri()+'/mr"><i class="icon-eye-open"></i> mr</button>';
        html += '<button class="btn tool-markunread" title="mark as unread" formaction="'+agent.getUri()+'/mu"><i class="icon-eye-close"></i> mu</button>';
        html += '<button class="btn tool-delete" title="delete"><i class="icon-trash" formaction="'+agent.getUri()+'/d"></i> d</button>';
        html += '</span></form>';
        html += '</div>';

        // messages
        html += '<table class="table table-condensed inbox">';
        messages.forEach(function(m, i) {
            // add html
            var date = new Date(m.date);
            var md = (date.getMonth()+1)+'/'+date.getDate()+'&nbsp;'+date.getHours()+':'+(date.getMinutes() < 10 ? '0' : '')+date.getMinutes();
            var trclass = (m.flags && !m.flags.seen ? 'unread' : '');
            html += '<tr class="'+trclass+'"><td style="color:gray">'+(i+1)+'</td><td><input class="msg-checkbox" type="checkbox" /></td><td><span class="label">'+m.service+'</span></td><td><a href="'+m.uri+'">'+m.summary+'</a></td><td><span style="color:gray">'+md+'</span></td></tr>';
            // record link
            links[i+1] = m.uri;
        });
        html += '</table>';

        // add to DOM
        body.innerHTML = html;

        // register toolbar events
        links.ck = function(request) {
            if (/post/i.test(request.method)) {
                var checkboxes = body.getElementsByClassName('msg-checkbox');
                // check for a range
                var range = [0, checkboxes.length];
                if (request.query && request.query.r) {
                    var rparts = request.query.r.split('-');
                    if (rparts.length == 2) {
                        range[0] = parseInt(rparts[0]) - 1;
                        range[1] = parseInt(rparts[1]);
                    } else {
                        range[0] = parseInt(rparts[0]) - 1;
                        range[1] = range[0] + 1;
                    }
                }
                // figure out if some need to be checked, or all dechecked
                var should_check = false;
                for (var i=range[0]; i < range[1]; i++) {
                    if (!checkboxes[i].checked) {
                        should_check = true;
                    }
                }
                // update elems
                for (var i=range[0]; i < range[1]; i++) {
                    checkboxes[i].checked = should_check;
                }
                return Link.response(204);
            }
            return { code:405, reason:'method not allowed' };
        };
        links.mr = function(request) {
            if (/post/i.test(request.method)) {
                // mark read all checked
                var checkboxes = body.getElementsByClassName('msg-checkbox');
                Array.prototype.forEach.call(checkboxes, function(checkbox, i) {
                    if (!checkbox.checked) { return; }
                    // update DOM
                    var row = checkbox.parentNode.parentNode;
                    row.className = row.className.replace('unread','');
                    // send message
                    var m = messages[i];
                    m.flags.seen = true;
                    agent.dispatch({ method:'put', uri:m.uri+'/flags', 'content-type':'application/json', body:{ seen:1 } });
                });
                return Link.response(204);
            }
            return { code:405, reason:'method not allowed' };
        };
        links.mu = function(request) {
            if (/post/i.test(request.method)) {
                // mark read all checked
                var checkboxes = body.getElementsByClassName('msg-checkbox');
                Array.prototype.forEach.call(checkboxes, function(checkbox, i) {
                    if (!checkbox.checked) { return; }
                    // update DOM
                    var row = checkbox.parentNode.parentNode;
                    if (/unread/.test(row.className) == false) {
                        row.className += ' unread';
                    }
                    // send message
                    var m = messages[i];
                    m.flags.seen = false;
                    agent.dispatch({ method:'put', uri:m.uri+'/flags', 'content-type':'application/json', body:{ seen:0 } });
                });
                return Link.response(204);
            }
            return { code:405, reason:'method not allowed' };
        };
        links.d = function(request) {
            if (/post/i.test(request.method)) {
                // delete all checked
                var checkboxes = body.getElementsByClassName('msg-checkbox');
                var deletions = [];
                // convert to array (checkboxes=nodelist, which dynamically updates when deleted from)
                var delindex=0; // used to track index to delete, which will change during splices
                Array.prototype.forEach.call(checkboxes, function(c) {
                    if (c.checked) {
                        // queue the deletion
                        deletions.push({ checkbox:c, index:delindex });
                        delindex--; // one less index in the world
                    } 
                    delindex++;
                });
                deletions.forEach(function(d) {
                    // remove DOM
                    var row = d.checkbox.parentNode.parentNode;
                    row.parentNode.removeChild(row);
                    // send delete message
                    var m = messages[d.index];
                    agent.dispatch({ method:'delete', uri:m.uri, accept:'application/json' });
                    // :TODO: notify user of success?
                    // remove message from cache
                    messages.splice(d.index, 1);
                });
                return Link.response(204);
            };
            return { code:405, reason:'method not allowed' };
        }
    }

    return Server;
});
