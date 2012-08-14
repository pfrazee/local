define(['link'], function(Link) {
    // Htmler Master Server
    // ====================
    // delivers a program for rendering HTML
    // to use, start in an agent, then request the html in that agent
    //   h>/tools/htmler
    //   h>http://linkshui.com
    // configuration =
    // {
    // }
    var HtmlerMS = function(structure, config) {
    };
    HtmlerMS.prototype.routes = [
        Link.route('serve', { uri:'^/?$', method:'get', accept:/application\/html\+json/i })
    ];
    HtmlerMS.prototype.serve = function() {
        var body = {
            _scripts:{ onload:setupHtmlerAgent }
        }; 
        return Link.response(200, body, 'application/html+json');
    };

    // Agent Client
    // ============
    function setupHtmlerAgent(agent, response) {
        // render shell
        agent.getBody().innerHTML = '<h6>HTMLer</h6><hr/><div class="htmler"></div>';
        var elem = agent.getBody().getElementsByClassName('htmler')[0];

        // intercept requests
        agent.setRequestHandler(function(req) {
            agent.dispatch(req).then(function(res) {
                if (/text\/html/i.test(res['content-type'])) {
                    elem.innerHTML = res.body;
                } else {
                    agent.defhandleResponse(res);
                }
            });
        });
    }

    return HtmlerMS;
});
