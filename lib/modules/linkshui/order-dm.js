define(function() {
    var OrderDm = function(container_id) {
        this.container_id = container_id;
        this.divs = {};
        // Add the divs to the DOM now
        var divhtml = [];
        for (var i=0; i < 20; i++) {
            divhtml.push('<div id="' + this.container_id + '-div' + i + '"></div>');
        }
        var container = __getContainer.call(this);
        container.innerHTML = divhtml.join('');
    };

    // Type interfaces
    // ================
    Link.addToType('js/lshui.orderdm.index-object', {
        toHtml:function() { return '<a href="'+this.data.uri+'">\'' + this.data.uri + '\'</a> created'; },
        toString:function() { return ''+this.data.index; }
    });

    // Routes
    // ======
    OrderDm.prototype.routes = [
        { cb:'infoHandler', uri:'^/?$', method:'get' },
        { cb:'createHandler', uri:'^/?$', method:'post' },
        { cb:'getHandler', uri:'^/([0-9]+)/?$', method:'get' },
        { cb:'setHandler', uri:'^/([0-9]+)/?$', method:'put' },
        { cb:'deleteHandler', uri:'^/([0-9]+)/?$', method:'delete' },
    ];

    // Handlers
    // ========
    OrderDm.prototype.infoHandler = function(request) {
        return { code:200, body:'<h2>Order <small>Div Manager</small></h2><p>Keeps your divs straight.&trade;</p>', 'content-type':'text/html' };
    };
    OrderDm.prototype.createHandler = function(request) {
        // find an open div
        for (var i=1; i < 20; i++) {
            if (!this.divs[i]) { break; }
        }
        if (i==20) { return { code:500, reason:'div limit reached' }; }
        // create
        __createDivFromRequest.call(this, i, request);
        // respond
        return { code:200, body:this.divs[i], 'content-type':'js/lshui.orderdm.index-object' };
    };
    OrderDm.prototype.getHandler = function(request, response, match) {
        // validate
        var index = +(match.uri[1]);
        if (!(index in this.divs) || !this.divs[index]) { return { code:404, reason:'div not found' }; }
        var div = this.divs[index];
        // if a get callback was given, use that
        if (div.onget) {
            return div.onget.call(div.cb_context, request, response, match);
        }
        // no callback, just give the contents of the div
        var elem = document.getElementById(div.elem_id + '-body');
        return { code:200, body:elem.innerHTML, 'content-type':'text/html' };
    };
    OrderDm.prototype.setHandler = function(request, response, match) {
        // validate
        var index = +(match.uri[1]);
        if (index < 0 || index >= 20) { return { code:400, reason:'bad index: '+index, body:'Index must be between 0 and 19.' }; }
        // remove the old dom
        __removeDivFromDom.call(this, index);
        // create
        __createDivFromRequest.call(this, index, request);
        return { code:200 };
    };
    OrderDm.prototype.deleteHandler = function(request, response, match) {
        // validate
        var index = +(match.uri[1]);
        if (index < 0 || index >= 20) { return { code:400, reason:'bad index: '+index, body:'Index must be between 0 and 19.' }; }
        // :TODO: run any callbacks
        // remove the div
        __removeDivFromDom.call(this, index);
        this.divs[index] = null;
        return { code:200 };
    };

    // Helpers
    // =======
    var __getContainer = function() {
        return document.getElementById(this.container_id);
    };
    var __createDivFromRequest = function(index, request) {
        var elem_id = this.container_id + '-div' + index;
        var div_uri = this.uri + '/' + index;
        // create html
        var html = [
            '<div class="orderdiv">',
            '<div class="orderdiv-titlebar">',

            '<form action="', div_uri, '">',
            '<div class="orderdiv-titlebar-ctrls btn-group">',
            '<button onclick="javascript:alert(\'todo\');return false;" title="collapse" class="btn btn-mini">_</button>',
            '<button formmethod="delete" title="close" class="btn btn-mini">&times;</button>',
            '</div>',
            '</form>',
            
            '<a href="', div_uri, '">\'', div_uri, '\'</a>',
            (index == 0 ? ' last response' : ' user buffer'),
            '</div>',
            '<div id="', elem_id + '-body','" class="orderdiv-body">', request.body.toString(), '</div>',
            
            '</div>',
            '</div>'
        ].join('');
        // add html to dom
        var div_elem = document.getElementById(elem_id);
        div_elem.innerHTML = html;
        // store info
        this.divs[index] = {
            index:index,
            elem_id:elem_id,
            uri:div_uri,
            delete_link:{ method:'delete', uri:div_uri },
            onget:request.onget,
            cb_context:request.context
        };
        // call the render callback
        if (request.onrender) {
            request.onrender.call(request.context, request, this.divs[index]);
        }
    };
    var __removeDivFromDom = function(index) {
        var div = this.divs[index];
        var elem = div && document.getElementById(div.elem_id);
        if (elem) { elem.innerHTML = ''; }
    }

    return OrderDm;
});