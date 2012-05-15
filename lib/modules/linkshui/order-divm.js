define(function() {
    var OrderDivM = function(container_id) {
        this.container_id = container_id;
        this.divs = {};
        // Add the divs to the DOM now
        var divhtml = [];
        for (var i=0; i < 20; i++) {
            divhtml.push('<div id="' + this.container_id + '-div' + i + '"></div>');
        }
        var container = this.__getContainer();
        container.innerHTML = divhtml.join('');
    };

    // Routes
    // ======
    OrderDivM.prototype.routes = [
        { cb:'createHandler', uri:'^/?$', method:'post' },
        { cb:'getHandler', uri:'^/([0-9]+)/?$', method:'get' },
        { cb:'setHandler', uri:'^/([0-9]+)/?$', method:'put' },
        { cb:'deleteHandler', uri:'^/([0-9]+)/?$', method:'delete' },
    ];

    // Handlers
    // ========
    OrderDivM.prototype.createHandler = function(request) {
        // find an open div
        for (var i=1; i < 20; i++) {
            if (!this.divs[i]) { break; }
        }
        if (i==20) { return { code:500, reason:'div limit reached' }; }
        // create
        this.__createDivFromRequest(i, request);
        // respond
        if (!request.accept || request.accept == 'text/html') {
            return { code:200, body:('<a href="'+this.divs[i].uri+'">\'' + this.divs[i].uri + '\'</a> created'), 'content-type':'text/html' };
        }
        if (request.accept.indexOf('js') == 0) { return { code:200, 'content-type':'js/int', body:i }; }
        return { code:200 };
    };
    OrderDivM.prototype.getHandler = function(request, response, match) {
        // validate
        var index = +(match.uri[1]);
        if (!(index in this.divs) || !this.divs[index]) { return { code:404, reason:'div not found' }; }
        var div = this.divs[index];
        // if a get callback was given, use that
        if (div.onget) {
            return div.onget.call(div.cb_context, request, response, match);
        }
        // no callback, just give the contents of the div
        // :TODO: do we need to respect 'accept'?
        var elem = document.getElementById(div.elem_id + '-body');
        return { code:200, body:elem.innerHTML, 'content-type':'text/html' };
    };
    OrderDivM.prototype.setHandler = function(request, response, match) {
        // validate
        var index = +(match.uri[1]);
        if (index < 0 || index >= 20) { return { code:400, reason:'bad index: '+index, body:'Index must be between 0 and 19.' }; }
        // remove the old dom
        this.__removeDivFromDom(index);
        // create
        this.__createDivFromRequest(index, request);
        return { code:200 };
    };
    OrderDivM.prototype.deleteHandler = function(request, response, match) {
        // validate
        var index = +(match.uri[1]);
        if (index < 0 || index >= 20) { return { code:400, reason:'bad index: '+index, body:'Index must be between 0 and 19.' }; }
        // :TODO: run any callbacks
        // remove the div
        this.__removeDivFromDom(index);
        this.divs[index] = null;
        return { code:200 };
    };

    // Helpers
    // =======
    OrderDivM.prototype.__getContainer = function() {
        return document.getElementById(this.container_id);
    };
    OrderDivM.prototype.__createDivFromRequest = function(index, request) {
        var elem_id = this.container_id + '-div' + index;
        var div_uri = this.uri + '/' + index;
        // create html
        var html = [
            '<div>',
            '<div class="order-title">',
            '<a href="', div_uri, '">\'', div_uri, '\'</a>',
            (index == 0 ? ' last response' : ' user buffer'),
            '</div>',
            '<div id="', elem_id + '-body','" class="order-body">', request.body.toString(), '</div>',
            '</div>'
        ].join('');
        // add html to dom
        var div_elem = document.getElementById(elem_id);
        div_elem.innerHTML = html;
        // store info
        this.divs[index] = {
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
    OrderDivM.prototype.__removeDivFromDom = function(index) {
        var div = this.divs[index];
        var elem = div && document.getElementById(div.elem_id);
        if (elem) { elem.innerHTML = ''; }
    }

    return OrderDivM;
});