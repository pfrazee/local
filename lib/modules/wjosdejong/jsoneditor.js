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
        // Handle data in the request, if a post
        var init_data = null;
        if (request.method == 'post' && request.body) {
            init_data = Link.getTypeInterface(request['content-type'], request.body);
        }

        // Create UI
        this.mediator.post({
            uri:'#dm',
            body:'<h3>JSON Editor Online <small>by Jos de Jong (<a href="https://github.com/wjosdejong/jsoneditoronline" title="github repo">https://github.com/wjosdejong/jsoneditoronline</a>)</small></h3><div class="jsoneditor"></div><style>div.jsoneditor-frame { border:none } td.jsoneditor-menu { background:none; border:none }</style>',
            onrender:function(request, div) {
                // Find the container
                var div_elem = document.getElementById(div.elem_id);
                var container = div_elem.getElementsByClassName('jsoneditor')[0];
                if (!container) { console.log('Unable to find json editor container'); return; }
                // Create the editor
                this.jsoneditor = new JSONEditor(container);
                if (init_data) { this.jsoneditor.set(init_data.toObject()); }
                // Apply some styling changes
                var menu = container.getElementsByClassName('jsoneditor-menu')[0];
                var buttons = menu.getElementsByTagName('button');
                for (var i=0; i < buttons.length; i++) { buttons[i].className = 'btn btn-mini'; }
            },
            onget:function(request, response, match) {
                return { code:200, body:this.jsoneditor.get(), 'content-type':'js/object' };
            },
            context:this
        });
        return { code:200 };
    };

    return Module;
});