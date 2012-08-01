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

        messages.sort(function(a,b) { return ((new Date(a.date).getTime() < new Date(b.date).getTime()) ? 1 : -1); });

        // styles
        html += '<style>';
        html += 'table.inbox tr.unread a { color:black }';
        html += 'table.inbox tr a { color:gray }';
        html += '</style>';
        
        // toolbar
        html += '<div style="height:35px">';
        html += '<span class="btn-group">';
        html += '<button class="btn tool-select" title="select/deselect"><i class="icon-check"></i></button>';
        html += '</span><span class="btn-group" style="display:inline-block">';
        html += '<button class="btn tool-markread" title="mark as read"><i class="icon-eye-open"></i></button>';
        html += '<button class="btn tool-markunread" title="mark as unread"><i class="icon-eye-close"></i></button>';
        html += '<button class="btn tool-delete" title="delete"><i class="icon-trash"></i></button>';
        html += '</span>';
        html += '</div>';

        // messages
        html += '<table class="table table-condensed inbox">';
        messages.forEach(function(m, i) {
            var date = new Date(m.date);
            var md = (date.getMonth()+1)+'/'+date.getDate()+'&nbsp;'+date.getHours()+':'+(date.getMinutes() < 10 ? '0' : '')+date.getMinutes();
            var trclass = (m.flags && !m.flags.seen ? 'unread' : '');
            html += '<tr class="'+trclass+'"><td><input class="msg-checkbox" type="checkbox" /></td><td><span class="label">'+m.service+'</span></td><td><a href="'+m.uri+'">'+m.summary+'</a></td><td><span style="color:gray">'+md+'</span></td></tr>';
        });
        html += '</table>';

        // add to DOM
        body.innerHTML = html;

        // register toolbar events
        var tool_select = body.getElementsByClassName('tool-select');
        var check_toggle = false;
        tool_select[0].onclick = function() {
            // simple toggle
            check_toggle = !check_toggle;
            var checkboxes = body.getElementsByClassName('msg-checkbox');
            Array.prototype.forEach.call(checkboxes, function(checkbox) {
                checkbox.checked = check_toggle;
            });
        };
        var tool_markread = body.getElementsByClassName('tool-markread');
        tool_markread[0].onclick = function() {
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
        };
        var tool_markunread = body.getElementsByClassName('tool-markunread');
        tool_markunread[0].onclick = function() {
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
        };
        var tool_delete = body.getElementsByClassName('tool-delete');
        tool_delete[0].onclick = function() {
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
        };
    }

    return Server;
});
