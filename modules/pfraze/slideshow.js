define(['link'], function() {
    var Module = function(structure, config) {
        this.uri = config.uri;
        this.num_slides = 5;
    };

    Module.prototype.routes = [
        Link.route('slidesHandler', { uri:"^/?$" }),
        Link.route('slideHandler', { uri:"^/([0-9]+)/?$" }),
        Link.route('linkHeader', { uri:"^/([0-9]*)/?$" })
    ];

    // handlers
    Module.prototype.slidesHandler = function(request) {
        var html = [];
        for (var i=1; i <= this.num_slides; i++) {
            html.push('<a href="'+this.uri+'/'+i+'">Slide '+i+'</a> ');
        }
        html = html.join('');
        return Link.response(200, html, 'text/html');
    };
    
    Module.prototype.slideHandler = function(request, match) {
        return Link.response(200, 'replace me', 'text/html');
    };

    Module.prototype.linkHeader = function(request, match, response) {
        response.link = [
            { uri:this.uri, rel:'overview' },
            { uri:this.uri + '/' + 1, rel:'first' },
            { uri:this.uri + '/' + this.num_slides, rel:'last' }
        ];
        if (match.uri[1]) {
            var id = parseInt(match.uri[1]);
            response.link.push({ uri:this.uri + '/' + __nextId.call(this, id), rel:'next' });
            response.link.push({ uri:this.uri + '/' + __prevId.call(this, id), rel:'prev' });
        }
        for (var i=1; i <= this.num_slides; i++) {
            response.link.push({ uri:this.uri + '/' + i, rel:'s'+i });
        }
        return response;
    };

    // helpers
    var __nextId = function(id) {
        if (id >= this.num_slides) {
            return id;
        }
        return id + 1;
    };
    var __prevId = function(id) {
        if (id <= 1) {
            return id;
        }
        return id - 1;
    };

    return Module;
});