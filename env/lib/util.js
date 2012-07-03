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

    // Exports
    return {
        runCB:__runCB
    };
});
