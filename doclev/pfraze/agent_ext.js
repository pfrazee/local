// add some request sugars
// :TEMPORARY:
$a_cons.prototype.get = function Pfraze_AgentExt_get(uri, opt_accept, opt_headers, opt_nofollow) {
    if (!opt_accept) { opt_accept = $prof.def_req_accept || 'application/html+json'; }
    var req = opt_headers || {};
    req.method = 'get';
    req.uri = uri;
    req.accept = opt_accept;
    if (opt_nofollow) { return this.dispatch(req); }
    return this.follow(req);
};
$a_cons.prototype.post = function Pfraze_AgentExt_post(uri, opt_accept, opt_headers, opt_nofollow) {
    if (!opt_accept) { opt_accept = $prof.def_req_accept || 'application/html+json'; }
    var req = opt_headers || {};
    req.method = 'post';
    req.uri = uri;
    req.accept = opt_accept;
    if (opt_nofollow) { return this.dispatch(req); }
    return this.follow(req);
};
