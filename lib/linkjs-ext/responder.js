// Responder
// =========
// extends linkjs
// pfraze 2012

(function (exports) {
	// responder sugar functions
	// =========================
	// this structure is used to build the various forms of the respond function
	// thanks to http://httpstatus.es/ for these descriptions
	var RESPONDER_FNS = {
		// information
		processing           : [102, 'server has received and is processing the request'],

		// success
		ok                   : [200, 'ok'],
		created              : [201, 'request has been fulfilled; new resource created'],
		accepted             : [202, 'request accepted, processing pending'],
		shouldBeOk           : [203, 'request processed, information may be from another source'],
		nonauthInfo          : [203, 'request processed, information may be from another source'],
		noContent            : [204, 'request processed, no content returned'],
		resetContent         : [205, 'request processed, no content returned, reset document view'],
		partialContent       : [206, 'partial resource return due to request header'],

		// redirection
		multipleChoices      : [300, 'multiple options for the resource delivered'],
		movedPermanently     : [301, 'this and all future requests directed to the given URI'],
		found                : [302, 'response to request found via alternative URI'],
		seeOther             : [303, 'response to request found via alternative URI'],
		notModified          : [304, 'resource has not been modified since last requested'],
		useProxy             : [305, 'content located elsewhere, retrieve from there'],
		switchProxy          : [306, 'subsequent requests should use the specified proxy'],
		temporaryRedirect    : [307, 'connect again to different uri as provided'],

		// client error
		badRequest           : [400, 'request cannot be fulfilled due to bad syntax'],
		unauthorized         : [401, 'authentication is possible but has failed'],
		forbidden            : [403, 'server refuses to respond to request'],
		notFound             : [404, 'requested resource could not be found'],
		methodNotAllowed     : [405, 'request method not supported by that resource'],
		notAcceptable        : [406, 'content not acceptable according to the Accept headers'],
		conflict             : [409, 'request could not be processed because of conflict'],
		gone                 : [410, 'resource is no longer available and will not be available again'],
		preconditionFailed   : [412, 'server does not meet request preconditions'],
		unsupportedMediaType : [415, 'server does not support media type'],
		teapot               : [418, 'I\'m a teapot'],
		enhanceYourCalm      : [420, 'rate limit exceeded'],
		unprocessableEntity  : [422, 'request unable to be followed due to semantic errors'],
		locked               : [423, 'resource that is being accessed is locked'],
		failedDependency     : [424, 'request failed due to failure of a previous request'],
		internalServerError  : [500, 'internal server error'],

		// server error
		serverError          : [500, 'internal server error'],
		notImplemented       : [501, 'server does not recognise method or lacks ability to fulfill'],
		badGateway           : [502, 'server received an invalid response from upstream server'],
		serviceUnavailable   : [503, 'server is currently unavailable'],
		unavailable          : [503, 'server is currently unavailable'],
		gatewayTimeout       : [504, 'gateway did not receive response from upstream server'],
		insufficientStorage  : [507, 'server is unable to store the representation'],
		notExtended          : [510, 'further extensions to the request are required']
	};

	var typeAliases = {
		'text'   : 'text/plain',
		'plain'  : 'text/plain',
		'json'   : 'application/json',
		'html'   : 'text/html',
		'xml'    : 'text/xml',
		'events-stream' : 'text/event-stream'
	};

	// Responder
	// =========
	// a protocol-helper for servers to easily fulfill requests
	// - `response` should be a `ServerResponse` object (given as the `response` param of the server's request handler fn)
	function Responder(response) {
		this.response = response;
	}

	// constructs and sends a response
	// - `status` may be a status integer or an array of `[status integer, reason string]`
	// - `type` may use an alias (such as 'html' for 'text/html' and 'json' for 'application/json')
	Responder.prototype.respond = function(status, type, headers) {
		var reason;
		if (Array.isArray(status)) {
			reason = status[1];
			status = status[0];
		}
		headers = headers || {};
		if (type)
			headers['content-type'] = (typeAliases[type] || type);
		this.response.writeHead(status, reason, headers);
		return this.response;
	};

	// add responder sugars
	for (var fnName in RESPONDER_FNS) {
		(function (status) {
			Responder.prototype[fnName] = function(type, headers) {
				return this.respond(status, type, headers);
			};
		})(RESPONDER_FNS[fnName]);
	}

	// sends the given response back verbatim
	// - if `writeHead` has been previously called, it will not change
	Responder.prototype.pipe = function(response, headersCB, bodyCb) {
		headersCB = headersCB || function(v) { return v; };
		bodyCb = bodyCb || function(v) { return v; };
		var self = this;
		var promise = Local.promise(response);
		promise
			.succeed(function(response) {
				if (!self.response.status) {
					// copy the header if we don't have one yet
					self.response.writeHead(response.status, response.reason, headersCB(response.headers));
				}
				if (response.body !== null && typeof response.body != 'undefined') { // already have the body?
					self.response.write(bodyCb(response.body));
				}
				if (response.on) {
					// wire up the stream
					response.on('data', function(data) {
						self.response.write(bodyCb(data));
					});
					response.on('end', function() {
						self.response.end();
					});
				} else {
					self.response.end();
				}
				return response;
			})
			.fail(function(err) {
				console.log('response piping error from upstream:', err);
				var ctype = err.response.headers['content-type'] || 'text/plain';
				var body = (ctype && err.response.body) ? err.response.body : '';
				self.badGateway(ctype).end(body);
				throw err;
			});
		return promise;
	};

	// creates a callback for a fixed response, used in promises
	Responder.prototype.cb = function(fnName, type, headers, body) {
		var fn = this[fnName]; var self = this;
		return function(v) {
			fn.call(self, type, headers).end(body);
			return v;
		};
	};

	// adds a type alias for use in the responder functions
	// - eg html -> text/html
	Responder.setTypeAlias = function(alias, mimetype) {
		typeAliases[alias] = mimetype;
	};

	// wrap helper
	function responder(res) {
		return (res instanceof Responder) ? res : new Responder(res);
	}

	exports.Responder = Responder;
	exports.responder = responder;
})(Link);