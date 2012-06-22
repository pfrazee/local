// Layout
// ======
// composes the final response, as needed

var Link = require('linkjs');
var Tint = require('tintjs');
var path = require('path');
var fs = require('fs');
var HtmlTemplate = null; // loaded in the ctor

var Layout = function(title, template_path) {
    this.title = title;
    this.template_path = template_path;
    // load html template, if needed
    if (!HtmlTemplate && template_path) {
        template_path = path.resolve(path.join(template_path, 'layout.html'));
        fs.readFile(template_path, 'utf8', function(err, data) {
            if (err) { console.log('Unable to find layout template at', template_path); }
            else {
                HtmlTemplate = new Tint.compile(data, function(title, body) {
                    this.title = title;
                    this.body = body;
                });
            }
        });
    }
};

// Route Handlers
// ==============
Layout.prototype.routes = {
    htmlHandler:{ uri:'.*', accept:'text/html' }
};
Layout.prototype.htmlHandler = function(request, response) {
    /*if (!response) { return { code:404, reason:'not found' }; }

    // Try to convert to HTML
    var iface = Link.getTypeInterface(response['content-type'], response.body);
    if (request.accept.indexOf('html') == -1 || !iface.toHtml) { return response; }
    var html = iface.toHtml();
    
    // Embed in layout and output HTML
    var layoutTmpl = new HtmlTemplate(this.title, html);
    response.body = layoutTmpl.toString();
    response['content-type'] = 'text/html';
    return response;*/
};

// Export
exports.Module = Layout;