define(['lib/linkregistry'], function(LinkRegistry) {
    var Env = {
        structure:null,
        init:__init,
        handleResponse:__handleResponse
    };
    
    function __init(structure) {
        this.structure = structure;
    }

    function __handleResponse(response) {
        // Do nothing if no content
        if (response.code == 204 || response.code == 205) { return; }
        // Update link registry
        LinkRegistry.update(response.link);
        // Send to the div manager
        var html = (response.body ? response.body.toString() : '');
        this.structure.dispatch({ uri:'#dm/0', method:'put', 'content-type':'text/html', body:html });
    }

    return Env;
});
