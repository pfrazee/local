// Layout
// ======
// composes the final response, as needed

var Link = require('pfraze-linkjs');
var Tint = require('tintjs');
var path = require('path');
var fs = require('fs');

var Layout = function(title, template_path) {
    this.title = title;
    this.template_path = template_path;
    // load html template
    var self = this;
    var template_path = path.resolve(path.join(template_path, 'layout.html'));
    fs.readFile(template_path, 'utf8', function(err, data) {
        if (err) { console.log('Unable to find layout template at', template_path); }
        else {
            self.HtmlTemplate = new Tint.compile(data, function(title, body) {
                this.title = title;
                this.body = body;
            });
        }
    });
};

// Routes
// ======
Layout.prototype.routes = [
    { cb:'htmlHandler', uri:'.*', accept:'text/html', bubble:true }
];

// Handlers
// ========
Layout.prototype.htmlHandler = function(request, response) {
    var layoutTmpl = new this.HtmlTemplate(this.title, response.body);
    response.body = layoutTmpl.toString();
    return response;
};

// Export
exports.Module = Layout;