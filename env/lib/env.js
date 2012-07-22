define(['link', 'lib/linkregistry', 'lib/html+json'], function(Link, LinkRegistry, HtmlJson) {
    var Env = {
        structure:null,
        init:init,
        agent:agent,
        handleRequest:handleRequest
    };
    
    function init(structure) {
        this.structure = structure;

        // Add type en/decoders
        Link.setTypeEncoder('application/html+json', HtmlJson.encode);
        Link.setTypeDecoder('application/html+json', HtmlJson.decode);
    }

    function agent(name, elem) {
        // :TODO:
        if (elem) {
            this.agents[name] = {
                elem:elem,
                onrequest:__handleRequest
            };
        }
        return this.agents[name];
    }

    // agents store request handlers
    // it's up to the CLI or the div manager to choose the agent, then update the request handler as needed

    function handleRequest(request) {
        // :TODO:
        // default behavior -- replace agent content
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
