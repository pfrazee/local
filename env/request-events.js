var RequestEvents = (function() {
    // Request Events
    // ==============
    // converts DOM events into linkjs request events
    var RequestEvents = {
        init:RequestEvents__init
    };

    // setup
    function RequestEvents__init() {
        document.body.addEventListener('click', RequestEvents__clickHandler);
        document.body.addEventListener('submit', RequestEvents__submitHandler);
        document.body.addEventListener('dragstart', RequestEvents__dragstartHandler);
        document.body.addEventListener('drop', RequestEvents__dropHandler);
    }

    function RequestEvents__clickHandler(e) {
        RequestEvents__trackFormSubmitter(e.target);
        var request = RequestEvents__extractLinkFromAnchor(e.target);
        if (request) {
            e.preventDefault();
            e.stopPropagation();
            var re = new CustomEvent('request', { bubbles:true, cancelable:true, detail:{ request:request }});
            e.target.dispatchEvent(re);
            return false;
        }
    }

    function RequestEvents__submitHandler(e) {
        var request = RequestEvents__extractLinkFromForm(e.target);
        if (request) {
            e.preventDefault();
            e.stopPropagation();
            var re = new CustomEvent('request', { bubbles:true, cancelable:true, detail:{ request:request }});
            e.target.dispatchEvent(re);
            return false;
        }
    }

    function RequestEvents__dragstartHandler(e) {
        e.dataTransfer.effectAllowed = 'none'; // allow nothing unless there's a valid link
        var link = null, elem = e.srcElement;
        RequestEvents__trackFormSubmitter(elem);
        if (elem.tagName == 'A') {
            link = RequestEvents__extractLinkFromAnchor(elem);
        } else if (elem.form) {
            link = RequestEvents__extractLinkFromForm(elem.form);
        }
        if (link) {
            e.dataTransfer.effectAllowed = 'link';
            e.dataTransfer.setData('application/link+json', JSON.stringify(link));
        }
    }

    function RequestEvents__dropHandler(evt) {
        evt.stopPropagation(); // no default behavior (redirects)

        try {
            var request = JSON.parse(evt.dataTransfer.getData('application/link+json'));
        } catch (except) {
            console.log('Bad data provided on RequestEvents drop handler', except, evt);
        }

        // drag/drop is basically a dynamic target attribute
        request.target = RequestEvents__findOwningAgent(evt.target);
        if (request.target == null) { return; } // dont handle without an existing context so that dropzones can instead

        var re = new CustomEvent('request', { bubbles:true, cancelable:true, detail:{ request:request }});
        evt.target.dispatchEvent(re);
        return false;
    }

    function RequestEvents__trackFormSubmitter(node) {
        while (node && node.classList && node.classList.contains('agent') == false) {
            if (node.form) {
                for (var i=0; i < node.form.length; i++) {
                    node.form[i].setAttribute('submitter', null); // clear the others out, to be safe
                }
                node.setAttribute('submitter', '1');
                break;
            }
            node = node.parentNode;
        }
    }

    function RequestEvents__findOwningAgent(node) {
        while (node) {
            if (node.classList && node.classList.contains('agent')) {
                return node;
            }
            node = node.parentNode;
        }
        return null;
    }

    function RequestEvents__extractLinkFromAnchor(node) {
        while (node && node.classList && node.classList.contains('agent') == false) {
            // filter to the link in this element stack
            if (node.tagName != 'A') { 
                node = node.parentNode;
                continue;
            }

            var uri = node.attributes.href.value;
            var accept = node.getAttribute('type');
            var target = node.getAttribute('target');

            if (uri == null || uri == '') { uri = '/'; }
            if (!target) { target = '_self'; }

            return { method:'get', uri:uri, accept:accept, target:target };
        }
        return null;
    }

    function RequestEvents__extractLinkFromForm(form) {
        var target_uri, enctype, method, target;

        // :NOTE: a lot of default browser behaviour has to (i think) be emulated here

        // Serialize the data
        var data = {};
        for (var i=0; i < form.length; i++) {
            var elem = form[i];
            // Pull value if it has one
            if (elem.value) {
                // don't pull from buttons unless recently clicked
                if (elem.tagName == 'button' || (elem.tagName == 'input' && (elem.type == 'button' || elem.type == 'submit')) ){
                    if (elem.getAttribute('submitter')) {
                        data[elem.name] = elem.value;
                    }
                } else {
                    data[elem.name] = elem.value;
                }
            }
            // If was recently clicked, pull its request attributes-- it's our submitter
            if (elem.getAttribute('submitter') == '1') {
                target_uri = elem.getAttribute('formaction');
                enctype = elem.getAttribute('formenctype');
                method = elem.getAttribute('formmethod');
                target = elem.getAttribute('formtarget');
                elem.setAttribute('submitter', '0');
            }
        }

        // If no element gave request attributes, pull them from the form
        if (!target_uri) { target_uri = form.getAttribute('action'); }
        if (!enctype) { enctype = form.enctype; }
        if (!method) { method = form.getAttribute('method'); }
        if (!target) { target = form.getAttribute('target'); }

        // Strip the base URI
        var base_uri = window.location.href.split('#')[0];
        if (target_uri.indexOf(base_uri) != -1) {
            target_uri = target_uri.substring(base_uri.length);
            if (target_uri.charAt(0) != '/') { target_uri = '/' + target_uri; }
        }

        var request = {
            method:method,
            uri:target_uri,
            target:target
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

        return request;
    }

    return RequestEvents;
})();
