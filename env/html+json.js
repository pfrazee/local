if (typeof define !== 'function') { var define = require('amdefine')(module) }
define(function() {
    function encode(obj) {
        // Convert scripts into strings
        if (obj._scripts) {
            for (var k in obj._scripts) {
                if (Array.isArray(obj._scripts[k])) {
                    obj._scripts[k].forEach(function(s, i) {
                        obj._scripts[k][i] = s.toString();
                    });
                } else {
                    obj._scripts[k] = obj._scripts[k].toString();
                }
            }
        }
        return JSON.stringify(obj);
    }
    function decode(str) {
        var obj = JSON.parse(str);
        // Eval scripts into functions
        if (obj._scripts) {
            for (var k in obj._scripts) {
                var fn = obj._scripts[k];
                // :TODO: support arrays
                if (typeof fn == "object") { fn = fn.fn; }
                else { obj._scripts[k] = {}; }
                obj._scripts[k].fn = eval('var fn = '+fn+'; fn');
            }
        }
        return obj;
    }
    function toHtml(target) {
        var type = typeof target;
        if (type == 'string') {
            // String, assume valid html
            return target;
        }
        if (type == 'object') { 
            // Array, htmlify and concat
            if (Array.isArray(target)) {
                var dest = '';
                target.forEach(function(v) {
                    dest += toHtml(v);
                });
                return dest;
            }
            // Object, htmlify
            var html = [];
            // opening tag
            html.push('<' + (target.tagName || 'div'));
            if (target.id) { html.push(' id="'+target.id+'"'); }
            if (target.className) { html.push(' class="'+target.className+'"'); }
            if (target.name) { html.push(' name="'+target.name+'"'); }
            if (target.title) { html.push(' title="'+target.title+'"'); }
            if (target.attributes) {
                for (var k in target.attributes) {
                    html.push(' '+k+'="'+target.attributes[k]+'"');
                }
            } 
            if (target.style) {
                var style = [];
                for (var k in target.style) {
                    style.push(k+'='+target.style[k]);
                }
                html.push(' style="'+style.join(';')+'"');
            }
            html.push('>');
            // content
            html.push(target.childNodes ? toHtml(target.childNodes) : '');
            // closing tag
            html.push('</' + (target.tagName || 'div') + '>');
            return html.join('');
        }
        if (type == 'function') {
            // Function...:TODO
            throw "functions todo";
        }
        // Scalar, stringify
        return ''+target;
    }
    function select(selector, target) {
        var type = typeof target;
        if (target && type == 'object') {
            // Array, call on each item
            if (Array.isArray(target)) {
                var hits = [];
                target.forEach(function(v) {
                    var hit = select(selector, v);
                    if (hit) { hits = hits.concat(hit); }
                });
                return hits;
            }
            // Object, do check
            var selector_parts = selector.split(' ');
            var cur_selector = selector_parts.shift();
            var remaining_selector = (selector_parts.length > 0 ? selector_parts.join(' ') : null);
            var match = false;
            // id search
            if (cur_selector.charAt(0) == '#') {
                if (target.id == cur_selector.substring(1)) { match = true; }
            }
            // class search
            else if (cur_selector.charAt(0) == '.') {
                if (target.className && target.className.indexOf(cur_selector.substring(1)) != -1) {
                    match = true;
                }
            }
            // tagname search
            else {
                if (!target.tagName && cur_selector == 'div') { match = true; }
                if (target.tagName && cur_selector == target.tagName) { match = true; }
            }
            // recursion 
            if (match) {
                if (!remaining_selector) {
                    // no more selector, start adding hits
                    var hits = [target];
                    var subhits = select(cur_selector, target.childNodes);
                    if (subhits) { hits = hits.concat(subhits); }
                    return hits;
                } else {
                    // more selector, search deeper
                    return select(remaining_selector, target.childNodes);
                }
            } else {
                // look for child hits
                return select(selector, target.childNodes);
            }
        }
        // Non-object, no hit possible
        return null;
    }
    function mknode(tag, idclass, attrs, childNodes) {
        tag = tag || 'div';
        idclass = idclass || '';
        // split idclass into id and className
        var id = null, className = null;
        var ids = /\#([^\s\#\.]+)/g.exec(idclass);
        if (ids) { id = ids[1]; }
        var classes = [];
        var classRe = /\.([^\s\#\.]+)/g;
        while (true) {
            var match = classRe.exec(idclass);
            if (match) { classes.push(match[1]); }
            else { break; }
        }
        if (classes.length) { className = classes.join(' '); }
        // create tag object
        var node = { tagName:tag };
        if (id) { node.id = id; }
        if (className) { node.className = className; }
        if (attrs && typeof attrs == 'object') {
            node.attributes = {};
            for (var k in attrs) {
                if (k == 'title' || k == 'name') {
                    node[k] = attrs[k];
                } else {
                    node.attributes[k] = attrs[k];
                }
            }
        }
        if (childNodes) {
            if (!Array.isArray(childNodes)) {
                childNodes = [childNodes];
            }
            node.childNodes = childNodes;
        }
        return node;
    }
    function addScript(target, name, fn, context, args) {
        if (typeof target != 'object') { throw "Invalid target type: must be object"; }
        if (!target._scripts) { target._scripts = {}; }
        if (!target._scripts[name]) { target._scripts[name] = []; }
        var fnObj = { fn:fn };
        if (context) { fnObj.context = context; }
        if (args) { fnObj.args = args; }
        target._scripts[name].push(fnObj);
    }

    return {
        encode:encode,
        decode:decode,
        toHtml:toHtml,
        select:select,
        mknode:mknode,
        addScript:addScript
    };
});
