local.at('#', function(req, res) {
    if (req.GET) {
        res.s204().end();
    } else {
        res.s405().end();
    }
});