define(['link'], function(Link) {
    // Statfeed Master Server
    // ======================
    // delivers a GUI for microblogging platforms
    // tested with StatusNet, should work with twitter as well
    // configuration =
    // {
    //   service: { uri:... }
    // }
    var StatfeedMS = function(structure, config) {
        this.structure = structure;
        this.uri = config.uri;
        this.service = config.service;
        this.service.feedLink = { 
            method:'get',
            uri:this.service.uri+'/statuses/home_timeline.json',
            accept:'application/json'
        };
        this.service.postUpdateLink = {
            method:'post',
            uri:this.service.uri+'/statuses/update.json',
            accept:'application/json',
            'content-type':'application/x-www-form-urlencoded'
        };
    };
    StatfeedMS.prototype.routes = [
        Link.route('serve', { uri:'^/?$', method:'get', accept:/application\/html\+json/i })
    ];
    StatfeedMS.prototype.serve = function() {
        var body = {
            _scripts:{ onload:setupStatfeedAgent },
            _data:{ service:this.service }
        }; 
        return Link.response(200, body, 'application/html+json');
    };

    // Statfeed Agent Server
    // =====================
    var StatfeedAS = function(agent) {
        this.agent = agent;
    };
    StatfeedAS.prototype.routes = [
        Link.route('postUpdate', { uri:'^/?$', method:'post' })
    ];
    StatfeedAS.prototype.postUpdate = function(request) {
        if (!request.body) {
            return { code:400, reason:'post body required' };
        }
        // dispatch to service
        var sReq = Object.create(this.agent.service.postUpdateLink);
        sReq.body = request.body;
        this.agent.dispatch(sReq).then(function(res) {
            if (res.code == 200) {
                // add to feed and re-render
                this.agent.updates.unshift(res.body);
                render(this.agent);
            }
        }, this);
        return { code:204 };
    };

    // Agent Client
    // ============
    function setupStatfeedAgent(agent, response) {
        try { 
            // grab params
            var service = response.body._data.service;
        } catch(e) { throw "malformed response body"; }

        // setup agent
        agent.service = service;
        agent.updates = [];
        agent.attachServer(new StatfeedAS(agent));

        // get feed
        agent.dispatch(service.feedLink).then(function(response) {
            if (response.code == 200) {
                agent.updates = response.body;
                render(agent);
            }
        });
    }
    function render(agent) {
        var html = '';
        var body = agent.getBody();

        html += '<div class="pfraze-statfeed">';
        // styles
        html += '<style>';
        html += '.pfraze-statfeed img { float:left; margin-top:1px }';
        html += '.pfraze-statfeed div.thumbnail { margin:0 0 5px 55px; }';
        html += '.pfraze-statfeed blockquote { margin:0 }';
        html += '</style>';

        // toolbar
        html += '<div style="height:35px">';
        html += '<form action="'+agent.getUri()+'" method="post">';
        html += '<div class="input-append">';
        html += '<input name="status" type="text" class="span9" />';
        html += '<button class="btn" title="post '+agent.getUri()+'"><i class="icon-ok-circle"></i> post</button>';
        html += '</div>';
        html += '</form>';
        html += '</div>';

        // statuses
        agent.updates.forEach(function(u, i) {
            var date = new Date(u.created_at);
            date = (date.getMonth()+1)+'/'+date.getDate()+'&nbsp;'+date.getHours()+':'+(date.getMinutes() < 10 ? '0' : '')+date.getMinutes();
            html += '<img src="'+u.user.profile_image_url+'" alt="'+u.user.name+'"/><div class="thumbnail"><blockquote><p>'+u.text+'</p><small>'+u.user.name+' @ '+date+'</small></blockquote></div>';
        });
        html += '</div>';

        // add to DOM
        body.innerHTML = html;
    }

    return StatfeedMS;
});
