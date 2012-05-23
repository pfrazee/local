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

    // Resource Meta
    // =============
    OrderDm.prototype.resources = {
        '/':{
            desc:'Linkshui div manager. Used to provide controlled access to sections of the browser DOM.',
            _get:'Module banner.',
            _post:'Allocates a new div and begins routing requests to the given control uri.',
            asserts:function(request) {
                if (request.method != 'get' && request.method != 'post') { throw { code:405, reason:'bad method' }; }
                if (request.method == 'post' && !request.body) { throw { code:400, reason:'request body is required' }; }
            }
        }
    };
    var DivResource = {
        desc:'Active div interface.',
        _get:'Provides the data in the div. If a control uri is specific, will pipe the request to it. Otherwise, gives the div innerHTML',
        _put:{
            desc:'Replaces the HTML in the div.',
            asserts:function(request) {
                if (!request.body) { throw { code:400, reason:'request body is required' }; }
            }
        },
        _delete:'Removes the div from the DOM and frees its index.',
        asserts:function(request) {
            if (request.method != 'get' && request.method != 'put' && request.method != 'delete') { throw { code:405, reason:'bad method' }; }
        }
    };
    
    // Type interfaces
    // ================
    Link.addToType('js/lshui.orderdm.index+object', {
        toHtml:function() { return '<a href="'+this.data.div_uri+'">\'' + this.data.div_uri + '\'</a> created'; },
        toString:function() { return ''+this.data.index; }
    });

    // Route Handlers
    // ==============
    OrderDm.prototype.routes = [
        { cb:'infoHandler', uri:'^/?$', method:'get' },
        { cb:'createHandler', uri:'^/?$', method:'post' },
        { cb:'getHandler', uri:'^/([0-9]+)/?$', method:'get' },
        { cb:'setHandler', uri:'^/([0-9]+)/?$', method:'put' },
        { cb:'collapseHandler', uri:'^/([0-9]+)/collapse/?$', method:'post' },
        { cb:'deleteHandler', uri:'^/([0-9]+)/?$', method:'delete' },
    ];
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
        this.resources['/'+i] = DivResource;
        // respond
        return { code:200, body:this.divs[i], 'content-type':'js/lshui.orderdm.index+object' };
    };
    OrderDm.prototype.getHandler = function(request, response, match) {
        // validate
        var index = +(match.uri[1]);
        if (!(index in this.divs) || !this.divs[index]) { return { code:404, reason:'div not found' }; }
        var div = this.divs[index];
        // if a ctrl uri was given, use that
        if (div.ctrl_uri) {
            var promise = new Link.Promise();
            this.mediator.get({ uri:div.ctrl_uri, accept:request.accept }, function(response) {
                promise.fulfill(response);
            });
            return promise;
        } else {
            // no uri, just give the contents of the div
            var elem = document.getElementById(div.elem_id + '-body');
            return { code:200, body:elem.innerHTML, 'content-type':'text/html' };
        }
    };
    OrderDm.prototype.setHandler = function(request, response, match) {
        // validate
        var index = +(match.uri[1]);
        if (index < 0 || index >= 20) { return { code:400, reason:'bad index: '+index, body:'Index must be between 0 and 19.' }; }
        // remove the old dom
        var old_div = this.divs[index];
        __removeDivFromDom.call(this, index);
        // create
        __createDivFromRequest.call(this, index, request, old_div);
        return { code:200 };
    };
    OrderDm.prototype.collapseHandler = function(request, response, match) {
        // validate
        var index = +(match.uri[1]);
        if (!(index in this.divs) || !this.divs[index]) { return { code:404, reason:'div not found' }; }
        var div = this.divs[index];
        // update the div
        div.is_collapsed = !div.is_collapsed;
        // update the dom
        var elem = document.getElementById(div.elem_id);
        var classname_index = elem.className.indexOf('collapsed');
        if (div.is_collapsed && classname_index == -1) {
            elem.className += ' collapsed';
        } else if (!div.is_collapsed && classname_index != -1) {
            elem.className = elem.className.replace(/[\s]*collapsed/i,'');
        }
        var collapse_elem = elem.getElementsByClassName('orderdm-collapse')[0];
        if (collapse_elem) { collapse_elem.innerText = div.is_collapsed ? '+' : '_'; }
        // if a ctrl uri was given, notify it
        if (div.ctrl_uri) {
            this.mediator.post({ uri:div.ctrl_uri + '/collapse' });
        }
        return { code:205 };
    };
    OrderDm.prototype.deleteHandler = function(request, response, match) {
        // validate
        var index = +(match.uri[1]);
        if (index < 0 || index >= 20) { return { code:400, reason:'bad index: '+index, body:'Index must be between 0 and 19.' }; }
        // notify the control
        var div = this.divs[index];
        if (div.ctrl_uri) {
            this.mediator.dispatch({ method:'delete', uri:div.ctrl_uri });
        }
        // remove the div
        __removeDivFromDom.call(this, index);
        this.divs[index] = null;
        delete this.resources['/'+index];
        return { code:205 };
    };

    // Helpers
    // =======
    var __getContainer = function() {
        return document.getElementById(this.container_id);
    };
    var __createDivFromRequest = function(index, request, old_div) {
        var elem_id = this.container_id + '-div' + index;
        var div_uri = this.uri + '/' + index;
        // construct the title
        var title = (index == 0 ? ' last response' : ' user buffer');
        if (request.title) { title = request.title; }
        // construct the body
        // (convert to string, if we need to)
        var body = request.body;
        if (typeof body != 'string') {
            var type_iface = Link.getTypeInterface(request['content-type'], body);
            body = type_iface.toHtml ? type_iface.toHtml() : type_iface.toString();
        }
        var html = [
            '<div class="orderdiv">',
            '<div class="orderdiv-titlebar">',

            '<form action="', div_uri, '">',
            '<div class="orderdiv-titlebar-ctrls btn-group">',
            '<button formmethod="post" formaction="', div_uri, '/collapse" title="collapse" class="btn btn-mini orderdm-collapse">', (old_div && old_div.is_collapsed) ? '+' : '_', '</button>',
            '<button formmethod="delete" title="close" class="btn btn-mini">&times;</button>',
            '</div>',
            '</form>',
            
            '<a href="', div_uri, '">\'', div_uri, '\'</a>',
            title,
            '</div>',
            '<div id="', elem_id + '-body','" class="orderdiv-body">', body, '</div>',
            
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
            div_uri:div_uri,
            ctrl_uri:request.ctrl_uri,
            is_collapsed:(old_div && old_div.is_collapsed)
        };
        // notify the render URI
        if (request.ctrl_uri) {
            this.mediator.post({
                uri:request.ctrl_uri + '/render',
                'content-type':'js/lshui.orderdm.index+object',
                body:this.divs[index]
            });
        }
    };
    var __removeDivFromDom = function(index) {
        var div = this.divs[index];
        var elem = div && document.getElementById(div.elem_id);
        if (elem) { elem.innerHTML = ''; }
    }

    return OrderDm;
});