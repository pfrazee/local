var helpers = require('./helpers');

// Response template prototype
function ResponseTemplate(opts) {
	this.opts = opts || {};
}

// Populates response with data
ResponseTemplate.prototype.writeout = function(ireq, ores) {
	var opts = this.opts;
	ores.status(opts.status, opts.reason);
	for (var k in opts) {
		if (helpers.isHeaderKey(k)) {
			ores.header(k, opts[k]);
		}
	}
	ores.end(opts.body);
};

var responses = {
	// notices
	'Ok': 200, 'Created': 201, 'No Content': 204,
	// redirects
	'PermanentRedirect': 301, 'TemporaryRedirect': 302,
	// request errors
	'Bad Request': 400, 'Unauthorized': 401, 'Forbidden': 403, 'Not Found': 404, 'Method Not Allowed': 405, 'Not Acceptable': 406, 'Request Timeout': 408, 'Conflict': 409,
	'Unsupported Media Type': 415, 'Im A Teapot': 418, 'Unprocessable Entity': 422,
	// internal errors
	'Internal Server Error': 500, 'Not Implemented': 501, 'Bad Gateway': 502, 'Service Unavailable': 503, 'Gateway Timeout': 504
};

module.exports.ResponseTemplate = ResponseTemplate;
for (var reason in responses) {
	var name = reason.replace(/ /g, '');

	// Define response template constructor
	module.exports[name] = (function(reason) {
		var status = responses[reason];
		return function(opts) {
			var tmpl = new ResponseTemplate(opts);
			tmpl.opts.status = status;
			tmpl.opts.reason = tmpl.opts.reason || reason;
			return tmpl;
		};
	})(reason);
}