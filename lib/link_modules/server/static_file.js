// Static File
// ===========
// serves static files from a root path

var Link = require('link-js');
var path = require('path');
var fs = require('fs');

var StaticFile = function(serve_path) {
    // create static file server
    this.serve_path = serve_path;
};

StaticFile.prototype.routes = [
    { cb:'serve', uri:'(.*)' }
];

StaticFile.prototype.serve = function(req, res, match) {
    var promise = new Link.Promise();
    // find file
    var file_path = path.resolve(path.join(this.serve_path, match.uri[1]));
    fs.readFile(file_path, function (e, data) {
        // serve
        // :TODO: mimetype
        if (e) {
            promise.fulfill({ code:404 });
        } else if (data) {
            promise.fulfill({ code:200, body:data });
        } else {
            promise.fulfill({ code:400 });
        }
    });
    return promise;
};

// export
exports.Module = StaticFile;