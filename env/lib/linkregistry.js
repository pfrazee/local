define(['link'], function() {
    var LinkRegistry = {
        config_links:[],
        response_links:[],
        init:__init,
        update:__update,
        currentLinks:__currentLinks,
        replace:__replace
    };

    function __init(links) {
        this.config_links = links || [];
    }

    function __update(links) {
        this.response_links = links || [];
    }
    
    function __currentLinks() {
        return this.config_links.concat(this.response_links);
    }    
    
    function __replace(uri) {
        var clinks = this.currentLinks();
        for (var i=0; i < clinks.length; i++) {
            if (uri == clinks[i].rel) {
                return clinks[i].uri;
            }
        }
        return uri;
    }

    return LinkRegistry;
});