// Static File
// ===========
// serves static files from a root path

var Link = require('linkjs');
var path = require('path');
var fs = require('fs');
var mimetype = require('mimetype');

var StaticFile = function(serve_path) {
    // create static file server
    this.serve_path = serve_path;
};

StaticFile.prototype.routes = {
    serve:{ uri:'(.*)' }
};

StaticFile.prototype.serve = function(req, match) {
    var promise = new Link.Promise();
    // find file
    var file_path = path.resolve(path.join(this.serve_path, match.uri[1]));
    fs.readFile(file_path, function (e, data) {
        // serve
        if (e) {
            promise.fulfill({ code:404 });
        } else if (data) {
            promise.fulfill({ code:200, body:data, 'content-type':mimetype.lookup(file_path) });
        } else {
            promise.fulfill({ code:400 });
        }
    });
    return promise;
};

// export
exports.Module = StaticFile;