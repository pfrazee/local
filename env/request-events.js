define(['./event-emitter'], function(EventEmitter) {
    // Request Events
    // ==============
    // observes given elemnts and converts DOM events into linkjs requests
    var RequestEvents = {
        init:RequestEvents__init,
        observe:RequestEvents__observe
    };
    EventEmitter.mixin(RequestEvents);

    // setup
    function RequestEvents__init() {
    }

    // register a DOM element for observation
    function RequestEvents__observe(observed_elem, agent_id) {
        observed_elem.onclick = function(e) {
            __clickHandler(e, observed_elem, agent_id);
        };
        observed_elem.onsubmit = function(e) {
            __submitHandler(e, agent_id);
        };
    }

    function __clickHandler(e, observed_elem, agent_id) {
        // Mark as recently clicked, if this (or a parent) is part of a form
        // (this helps out the submit interceptor)
        var node = e.target;
        while (node && node != observed_elem) {
            if (node.form) {
                for (var i=0; i < node.form.length; i++) {
                    node.form[i].setAttribute('clicked', null); // clear the others out, to be safe
                }
                node.setAttribute('clicked', '1');
                break;
            }
            node = node.parentNode;
        }
        // Handle the request, if a link
        node = e.target;
        while (node && node != observed_elem) {
            if (node.tagName != 'A') { 
                node = node.parentNode;
                continue;
            }
            // stop defaults
            e.preventDefault();
            if (e.stopPropagation) { e.stopPropagation(); }
            // extract uri
            var uri = node.attributes.href.value;
            if (uri == null || uri == '') { uri = '/'; }
            // extract accept header
            var accept = node.getAttribute('type');
            if (!accept) { accept = 'application/html+json'; }
            // emit request event
            RequestEvents.emitEvent('request', { method:'get', uri:uri, accept:accept }, agent_id);
            break;
        }
    }

    function __submitHandler(e, agent_id) {
        var form = e.target;
        var target_uri, enctype, method;

        // :NOTE: a lot of default browser behaviour has to (?) be emulated here

        // Serialize the data
        var data = {};
        for (var i=0; i < form.length; i++) {
            var elem = form[i];
            // Pull value if it has one
            if (elem.value) {
                // don't pull from buttons unless recently clicked
                if (elem.tagName == 'button' || (elem.tagName == 'input' && (elem.type == 'button' || elem.type == 'submit')) ){
                    if (elem.getAttribute('clicked')) {
                        data[elem.name] = elem.value;
                    }
                } else {
                    data[elem.name] = elem.value;
                }
            }
            // If was recently clicked, pull its request attributes-- it's our submitter
            if (elem.getAttribute('clicked') == '1') {
                target_uri = elem.getAttribute('formaction');
                enctype = elem.getAttribute('formenctype');
                method = elem.getAttribute('formmethod');
                elem.setAttribute('clicked', '0');
            }
        }

        // If no element gave request attributes, pull them from the form
        if (!target_uri) { target_uri = form.getAttribute('action'); }
        if (!enctype) { enctype = form.enctype; }
        if (!method) { method = form.getAttribute('method'); }

        // Convert the data to the given enctype
        if (!enctype) { enctype = 'js'; }
        // :TODO: ?

        // Strip the base URI
        var base_uri = window.location.href.split('#')[0];
        if (target_uri.indexOf(base_uri) != -1) {
            target_uri = target_uri.substring(base_uri.length);
            if (target_uri.charAt(0) != '/') { target_uri = '/' + target_uri; }
        }

        // Taking control
        e.preventDefault();
        if (e.stopPropagation) { e.stopPropagation(); }

        // Build the request
        var request = {
            method:method,
            uri:target_uri,
            accept:'application/html+json'
        };
        if (form.acceptCharset) { request.accept = form.acceptCharset; }

        // Build request body
        if (method == 'get') {
            var qparams = [];
            for (var k in data) {
                qparams.push(k + '=' + data[k]);
            }
            if (qparams.length) {
                target_uri += '?' + qparams.join('&');
                request.uri = target_uri;
            }
        } else {
            request.body = data;
            request['content-type'] = enctype;
        }

        RequestEvents.emitEvent('request', request, agent_id);
    }

    return RequestEvents;
});
