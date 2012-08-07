define(function() {
    // Helper to run a callback object
    //  - composes calling arguments from fnObj and calling args
    //  - fnObj = { fn:function, args:array, context:object }
    function __execFn(fnObj, args, context) {
        if (!fnObj) { return; }
        if (typeof fnObj == 'function') {
            fnObj = { fn:fnObj }; // convert to object
        }
        context = context || fnObj.context || undefined;

        // Build args
        // (caller arguments followed by fn arguments)
        if (args) {
            if (!Array.isArray(args)) { args = [args]; }
        } else { args = []; }
        if (fnObj.args) {
            if (!Array.isArray(fnObj.args)) { fnObj.args = [fnObj.args]; }
        } else { fnObj.args = []; }
        args = args.concat(fnObj.args);

        // Call
        fnObj.fn.apply(context, args);
    }

    // Helper to run the scripts in a DOM element
    // http://stackoverflow.com/questions/2592092/executing-script-elements-inserted-with-innerhtml
    var __execElementScripts = function(elem) {
        var head = document.getElementsByTagName('head')[0] || document.documentElement;
        var i, child, cnodes = elem.childNodes;
        var script, data;
        // pull out script nodes
        for (i=0; cnodes[i]; i++) {
            child = cnodes[i];
            if (/script/i.test(child.nodeName) && (!child.type || /text\/javascript/i.test(child.type))) {
                // pull out the script
                elem.removeChild(child);
                data = child.text || child.textContent || child.innerHTML || '';
                // create a new script element based on it
                script = document.createElement('script');
                script.type = 'text/javascript';
                try {
                    script.appendChild(document.createTextNode(data));
                } catch (e) {
                    script.text = data;
                }
                // eval, then remove
                head.insertBefore(script, head.firstChild);
                head.removeChild(script);
            } else if (child.childNodes.length) {
                // recurse
                // :TODO: pretty slow, so maybe not
                //__execElementScripts(child);
            }
        }

    };

    // Exports
    return {
        execFn:__execFn,
        execElementScripts:__execElementScripts
    };
});
