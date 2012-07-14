define(['link', 'lib/linkregistry', 'lib/html+json'], function(Link, LinkRegistry, HtmlJson) {
    var Env = {
        structure:null,
        init:__init,
        handleResponse:__handleResponse
    };
    
    function __init(structure) {
        this.structure = structure;

        // Add type en/decoders
        Link.setTypeEncoder('application/html+json', HtmlJson.encode);
        Link.setTypeDecoder('application/html+json', HtmlJson.decode);
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
