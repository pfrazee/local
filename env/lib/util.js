define(function() {
    // Helper to run a callback object
    //  - composes calling arguments from cbObj and calling args
    //  - cbObj = { cb:function, args:array, context:object }
    function __runCB(cbObj, args) {
        if (!cbObj) { return; }
        if (typeof cbObj == 'function') {
            cbObj = { cb:cbObj }; // convert to object
        }

        // Build args
        // (caller arguments followed by cb arguments)
        if (args) {
            if (!Array.isArray(args)) { args = [args]; }
        } else { args = []; }
        if (cbObj.args) {
            if (!Array.isArray(cbObj.args)) { cbObj.args = [cjObj.args]; }
        } else { cbObj.args = []; }
        args = args.concat(cbObj.args);

        // Call
        cbObj.cb.apply(cbObj.context, args);
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
        runCB:__runCB,
        execElementScripts:__execElementScripts
    };
});
