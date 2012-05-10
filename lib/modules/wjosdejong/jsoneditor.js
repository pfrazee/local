define(['./jsoneditoronline/jsoneditor'], function() {
    var Module = function() {
        this.jsoneditor = null;
        Link.addStylesheet('/modules/wjosdejong/jsoneditoronline/jsoneditor.css');
    };

    Module.prototype.routes = [
        { cb:"editor", uri:"^/?$" }
    ];

    Module.prototype.editor = function(request) {
        // Only process if no accept header, or accept = text/html
        if (request.accept && !/text\html/i.test(request.accept)) { return; }
        // Handle json in the request, if a post
        var init_json = null;
        if (request.method == 'post' && request.body) {
            if (/application\json/i.test(request['content-type']) || typeof request.body == 'string') {
                try { init_json = JSON.parse(request.body); }
                catch (e) {
                    console.log('Unable to parse json:', request.body);
                    return { code:400, reason:'json parse', body:('Failed to parse JSON: ' + e) };
                }
            } else if (typeof request.body == 'object') {
                init_json = request.body;
            }
        }
        // Register editor init
        this.mediator.afterRender(function() {
            var container = document.getElementById('jsoneditor');
            if (!container) { console.log('Unable to find json editor container'); }
            else {
                this.jsoneditor = new JSONEditor(container);
                if (init_json) { this.jsoneditor.set(init_json); }
            }
        }, this);
        // Give interface
        return { code:200, body:'<h3>JSON Editor Online <small>by Jos de Jong (<a href="https://github.com/wjosdejong/jsoneditoronline" title="github repo">https://github.com/wjosdejong/jsoneditoronline</a>)</small></h3><div id="jsoneditor"></div>', 'content-type':'text/html' };
    };

    return Module;
});