define(['./jsoneditoronline/jsoneditor'], function() {
    var Module = function() {
        this.jsoneditor = null;
        // :TODO: set this up to handle multiple editors at once
        Link.addStylesheet('/modules/wjosdejong/jsoneditoronline/jsoneditor.css');
    };

    Module.prototype.routes = [
        { cb:"editor", uri:"^/?$" }
    ];

    Module.prototype.editor = function(request) {
        // Only process if no accept header, or accept = text/html
        if (request.accept && /text\/html/i.test(request.accept) == false) { console.log(request.accept); return; }
        
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

        // Create UI
        this.mediator.post({
            uri:'#divm',
            body:'<h3>JSON Editor Online <small>by Jos de Jong (<a href="https://github.com/wjosdejong/jsoneditoronline" title="github repo">https://github.com/wjosdejong/jsoneditoronline</a>)</small></h3><div class="jsoneditor"></div><style>div.jsoneditor-frame { border:none } td.jsoneditor-menu { background:none; border:none }</style>',
            onrender:function(request, div) {
                // Find the container
                var div_elem = document.getElementById(div.elem_id);
                var container = div_elem.getElementsByClassName('jsoneditor')[0];
                if (!container) { console.log('Unable to find json editor container'); return; }
                // Create the editor
                this.jsoneditor = new JSONEditor(container);
                if (init_json) { this.jsoneditor.set(init_json); }
                // Apply some styling changes
                var menu = container.getElementsByClassName('jsoneditor-menu')[0];
                var buttons = menu.getElementsByTagName('button');
                for (var i=0; i < buttons.length; i++) { buttons[i].className = 'btn btn-mini'; }
            },
            onget:function(request, response, match) {
                // :TODO: 'accept'?
                return { code:200, body:this.jsoneditor.get(), 'content-type':'js/object' };
            },
            context:this
        });
        return { code:200 };
    };

    return Module;
});