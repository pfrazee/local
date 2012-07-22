define(['link', 'lib/env', 'lib/util', 'lib/html+json'], function(Link, Env, Util, HtmlJson) {
    var OrderDm = function(structure, config) {
        this.uri = config.uri;
        this.container_id = config.container_id;
        this.divs = {};
        this.structure = structure;
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
    // :TODO: replace with appropriate handler behavior
    var toHtml = function() { return '<a href="'+this.data.div_uri+'">\'' + this.data.div_uri + '\'</a> created'; };

    // Route Handlers
    // ==============
    OrderDm.prototype.routes = [
        Link.route('infoHandler', { uri:'^/?$', method:'get' }),
        Link.route('createHandler', { uri:'^/?$', method:'post' }),
        Link.route('getHandler', { uri:'^/([0-9]+)/?$', method:'get' }),
        Link.route('setHandler', { uri:'^/([0-9]+)/?$', method:'put' }),
        Link.route('collapseHandler', { uri:'^/([0-9]+)/collapse/?$', method:'post' }),
        Link.route('deleteHandler', { uri:'^/([0-9]+)/?$', method:'delete' }),
    ];
    OrderDm.prototype.infoHandler = function(request) {
        return Link.response(200, '<h2>Order <small>Div Manager</small></h2><p>Keeps your divs straight.&trade;</p>', 'text/html');
    };
    OrderDm.prototype.createHandler = function(request, match, response) {
        // find an open div
        for (var i=1; i < 20; i++) {
            if (!this.divs[i]) { break; }
        }
        if (i==20) { return Link.response(500, 0, 0, { reason:'div limit reached' }); }
        // create
        __createDivFromRequest.call(this, i, request);
        // respond
        if (request.v) {
            return Link.response(200, this.divs[i], 'application/json');
        }
        return Link.response(205);
    };
    OrderDm.prototype.getHandler = function(request, match, response) {
        // validate
        var index = +(match.uri[1]);
        if (!(index in this.divs) || !this.divs[index]) { return { code:404, reason:'div not found' }; }
        var div = this.divs[index];
        // if a ctrl uri was given, use that
        if (div.ctrl_uri) {
            var promise = new Link.Promise();
            this.structure.get({ uri:div.ctrl_uri, accept:request.accept }, function(response) {
                promise.fulfill(response);
            });
            return promise;
        } else {
            // no uri, just give the contents of the div
            var elem = document.getElementById(div.elem_id + '-body');
            return Link.response(200, elem.innerHTML, 'text/html');
        }
    };
    OrderDm.prototype.setHandler = function(request, match, response) {
        // validate
        var index = +(match.uri[1]);
        if (index < 0 || index >= 20) { return { code:400, reason:'bad index: '+index, body:'Index must be between 0 and 19.' }; }
        // remove the old dom
        var old_div = this.divs[index];
        __removeDivFromDom.call(this, index);
        // create
        __createDivFromRequest.call(this, index, request, old_div);
        return Link.response(200);
    };
    OrderDm.prototype.collapseHandler = function(request, match, response) {
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
            this.structure.post({ uri:div.ctrl_uri + '/collapse' });
        }
        return Link.response(205);
    };
    OrderDm.prototype.deleteHandler = function(request, match, response) {
        // validate
        var index = +(match.uri[1]);
        if (index < 0 || index >= 20) { return { code:400, reason:'bad index: '+index, body:'Index must be between 0 and 19.' }; }
        // notify the control
        var div = this.divs[index];
        if (div.ctrl_uri) {
            this.structure.dispatch({ method:'delete', uri:div.ctrl_uri });
        }
        // remove the div
        __removeDivFromDom.call(this, index);
        this.divs[index] = null;
        return Link.response(205);
    };

    // Helpers
    // =======
    var __getContainer = function() {
        return document.getElementById(this.container_id);
    };
    var __createDivFromRequest = function(index, request, old_div) {
        var mknode = HtmlJson.mknode;
        var elem_id = this.container_id + '-div' + index;
        var div_uri = this.uri + '/' + index;

        // construct the title
        var title = (index == 0 ? ' last response' : ' user buffer');
        if (request.title) { title = request.title; }

        // construct the body
        var body = request.body;
        if (request['content-type'] != 'application/html+json') {
            // encode to a string
            body = Link.encodeType(body, request['content-type']);
            // escape so that html isnt inserted
            body = body.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        }
        // standard wrapper markup
        var nodes = mknode('div','.orderdiv',0,[
            mknode('div','.orderdiv-titlebar',0,[
                mknode('form',0,{action:div_uri},[
                    mknode('div','.orderdiv-titlebar-ctrls.btn-group',0,[
                        mknode('button','.btn.btn-mini.orderdm-collapse',{formmethod:'post',formaction:div_uri+'/collapse',title:'collapse'},[(old_div && old_div.is_collapsed) ? '+' : '_']),
                        mknode('button','.btn.btn-mini',{formmethod:'delete',title:'close'},['&times;'])
                    ])
                ]),
                mknode('a',0,{href:div_uri},["'",div_uri,"'"]),
                title
            ]),
            mknode('div','#'+elem_id+'-body.orderdiv-body',0,[body])
        ]);
        var html = HtmlJson.toHtml(nodes);

        // add html to dom
        var div_elem = document.getElementById(elem_id);
        div_elem.innerHTML = html;

        // run load script
        if (request['content-type'] == 'application/html+json') {
            if (body._scripts && body._scripts.load) {
                var div_body_elem = document.getElementById(elem_id+'-body');
                var fns = request.body._scripts.load;
                if (!Array.isArray(fns)) { fns = [fns]; }
                fns.forEach(function(fn) { Util.execFn(fn, [div_body_elem, Env], body); });
            }
        }

        // store info
        this.divs[index] = {
            index:index,
            elem_id:elem_id,
            div_uri:div_uri,
            ctrl_uri:request.ctrl_uri,
            is_collapsed:(old_div && old_div.is_collapsed)
        };
    };
    var __removeDivFromDom = function(index) {
        var div = this.divs[index];
        var elem = div && document.getElementById(div.elem_id);
        if (elem) { elem.innerHTML = ''; }
    }

    return OrderDm;
});
