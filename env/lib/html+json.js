define(function() {
    function encode(obj) {
        return JSON.stringify(obj);
    }
    function decode(str) {
        return JSON.parse(str);
    }
    function toHtml(target) {
        targetar type = typeof target;
        if (type == 'string') {
            // String, assume valid html
            return target;
        }
        if (type == 'object') { 
            // Array, htmlify and concat
            if (Array.isArray(target)) {
                var dest = '';
                target.foreach(function(v) {
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
    function select(target, selector) {
        var type = typeof target;
        if (target && type == 'object') {
            // Array, call on each item
            if (Array.isArray(target) {
                var hits = [];
                target.foreach(function(v) {
                    var hit = select(v, selector);
                    if (hit) { hits = hits.concat(hit)); }
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
                cur_selector = cur_selector.substring(1);
                if (target.id == cur_selector) { match = true; }
            }
            // class search
            else if (cur_selector.charAt(0) == '.') {
                cur_selector = cur_selector.substring(1);
                if (target.className && target.className.indexOf(cur_selector) != -1) {
                    match = true;
                }
            }
            // tagname search
            else {
                if (!target.tagName && cur_selector == 'div') { match = true; }
                if (target.tagName && cur_selector == target.tagName) { match = true; }
            }
            // match?
            if (match) {
                if (!remaining_selector) {
                    return [target];
                } else {
                    return select(target.childNodes, remaining_selector);
                }
            }
        }
        // Non-object, no hit possible
        return null;
    }

    return {
        encode:encode,
        decode:decode,
        toHtml:toHtml,
        select:select
    };
});
