define(['link'], function(Link) {
    function CommanderMS() {
    }
    CommanderMS.prototype.routes = [
        Link.route('serv', { uri:'^/?$', method:'get', accept:/application\/html\+json/i })
    ];
    CommanderMS.prototype.serv = function CommanderMS__serv() {
        return { code:200, body:{ childNodes:['test'] }, 'content-type':'application/html+json' };
    };

    return CommanderMS;
});
