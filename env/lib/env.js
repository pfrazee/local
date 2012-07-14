define(['link', 'lib/linkregistry'], function(Link, LinkRegistry) {
    var Env = {
        structure:null,
        init:__init,
        handleResponse:__handleResponse
    };
    
    function __init(structure) {
        this.structure = structure;

        // Add type en/decoders
        var todo = function(x) { return x; } // uhh... :TODO:
        Link.setTypeEncoder('application/text+html', todo);
        Link.setTypeDecoder('application/text+html', todo);
    }

    function __handleResponse(response) {
        // Do nothing if no content
        if (response.code == 204 || response.code == 205) { return; }
        // Update link registry
        LinkRegistry.update(response.link);
        // Send to the div manager
        this.structure.dispatch({ uri:'#dm/0', method:'put', 'content-type':response['content-type'], body:response.body, onrender:response.onrender });
    }

    return Env;
});
