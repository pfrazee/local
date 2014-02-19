var constants = require('../constants.js');
var util = require('../util');
var promise = require('../promises.js').promise;
var helpers = require('./helpers.js');
var UriTemplate = require('./uri-template.js');
var httpl = require('./httpl.js');
var Request = require('./request.js');
var Response = require('./response.js');
var dispatch = require('./dispatch.js').dispatch;
var subscribe = require('./subscribe.js').subscribe;

// AgentContext
// ============
// INTERNAL
// information about the resource that a agent targets
//  - exists in an "unresolved" state until the URI is confirmed by a response from the server
//  - enters a "bad" state if an attempt to resolve the link failed
//  - may be "relative" if described by a relation from another context (eg a query or a relative URI)
//  - may be "absolute" if described by an absolute URI
// :NOTE: absolute contexts may have a URI without being resolved, so don't take the presence of a URI as a sign that the resource exists
function AgentContext(query) {
	this.query = query;
	this.resolveState = AgentContext.UNRESOLVED;
	this.error = null;
	this.queryIsAbsolute = (typeof query == 'string' && helpers.isAbsUri(query));
	if (this.queryIsAbsolute) {
		this.url  = query;
		this.urld = helpers.parseUri(this.url);
	} else {
		this.url  = null;
		this.urld = null;
	}
}
AgentContext.UNRESOLVED = 0;
AgentContext.RESOLVED   = 1;
AgentContext.FAILED     = 2;
AgentContext.prototype.isResolved = function() { return this.resolveState === AgentContext.RESOLVED; };
AgentContext.prototype.isBad      = function() { return this.resolveState === AgentContext.FAILED; };
AgentContext.prototype.isRelative = function() { return (!this.queryIsAbsolute); };
AgentContext.prototype.isAbsolute = function() { return this.queryIsAbsolute; };
AgentContext.prototype.getUrl     = function() { return this.url; };
AgentContext.prototype.getError   = function() { return this.error; };
AgentContext.prototype.resetResolvedState = function() {
	this.resolveState = AgentContext.UNRESOLVED;
	this.error = null;
};
AgentContext.prototype.setResolved = function(url) {
	this.error = null;
	this.resolveState = AgentContext.RESOLVED;
	if (url) {
		this.url  = url;
		this.urld = helpers.parseUri(this.url);
	}
};
AgentContext.prototype.setFailed = function(error) {
	this.error = error;
	this.resolveState = AgentContext.FAILED;
};

// Agent
// =========
// EXPORTED
// API to follow resource links (as specified by the response Link header)
//  - uses the rel attribute as the primary link label
//  - uses URI templates to generate URIs
//  - queues link navigations until a request is made
/*

// EXAMPLE 1. Get Bob from Foobar.com
// - basic navigation
// - requests
var foobarService = local.agent('https://foobar.com');
var bob = foobarService.follow('|collection=users|item=bob');
// ^ or local.agent('nav:||https://foobar.com|collection=users|item=bob')
// ^ or foobarService.follow([{ rel: 'collection', id: 'users' }, { rel: 'item', id:'bob' }]);
// ^ or foobarService.follow({ rel: 'collection', id: 'users' }).follow({ rel: 'item', id:'bob' });
bob.get()
	// -> HEAD https://foobar.com
	// -> HEAD https://foobar.com/users
	// -> GET  https://foobar.com/users/bob (Accept: application/json)
	.then(function(response) {
		var bobsProfile = response.body;

		// Update Bob's email
		bobsProfile.email = 'bob@gmail.com';
		bob.put(bobsProfile);
		// -> PUT https://foobar.com/users/bob { email:'bob@gmail.com', ...} (Content-Type: application/json)
	});

// EXAMPLE 2. Get all users who joined after 2013, in pages of 150
// - additional navigation query parameters
// - server-driven batching
var pageCursor = foobarService.follow('|collection=users,since=2013-01-01,limit=150');
pageCursor.get()
	// -> GET https://foobar.com/users?since=2013-01-01&limit=150 (Accept: application/json)
	.then(function readNextPage(response) {
		// Send the emails
		emailNewbieGreetings(response.body); // -- emailNewbieGreetings is a fake utility function

		// Go to the 'next page' link, as supplied by the response
		pageCursor = pageCursor.follow('|next');
		return pageCursor.get().then(readNextPage);
		// -> GET https://foobar.com/users?since=2013-01-01&limit=150&offset=150 (Accept: application/json)
	})
	.fail(function(response, request) {
		// Not finding a 'rel=next' link means the server didn't give us one.
		if (response.status == local.LINK_NOT_FOUND) { // 001 Local: Link not found - termination condition
			// Tell Bob his greeting was sent
			bob.follow('|grimwire.com/-mail/inbox').post({
				title: '2013 Welcome Emails Sent',
				body: 'Good work, Bob.'
			});
			// -> POST https://foobar.com/mail/users/bob/inbox (Content-Type: application/json)
		} else {
			// Tell Bob something went wrong
			bob.follow('|grimwire.com/-mail/inbox').post({
				title: 'ERROR! 2013 Welcome Emails Failed!',
				body: 'Way to blow it, Bob.',
				attachments: {
					'dump.json': {
						context: pageCursor.getContext(),
						request: request,
						response: response
					}
				}
			});
			// -> POST https://foobar.com/mail/users/bob/inbox (Content-Type: application/json)
		}
	});
*/
function Agent(context, parentAgent) {
	this.context         = context         || null;
	this.parentAgent = parentAgent || null;
	this.links           = null;
	this.proxyTmpl       = null;
	this.requestDefaults = null;
}

// Sets defaults to be used in all requests
// - eg nav.setRequestDefaults({ method: 'GET', headers: { authorization: 'bob:pass', accept: 'text/html' }})
// - eg nav.setRequestDefaults({ proxy: 'httpl://myproxy.app' })
Agent.prototype.setRequestDefaults = function(v) {
	this.requestDefaults = v;
};

// Helper to copy over request defaults
function copyDefaults(target, defaults) {
	for (var k in defaults) {
		if (k == 'headers' || !!target[k])
			continue;
		// ^ headers should be copied per-attribute
		if (typeof defaults[k] == 'object')
			target[k] = util.deepClone(defaults[k]);
		else
			target[k] = defaults[k];
	}
	if (defaults.headers) {
		if (!target.headers)
			target.headers = {};
		copyDefaults(target.headers, defaults.headers);
	}
}

// Executes an HTTP request to our context
//  - uses additional parameters on the request options:
//    - noretry: bool, should the url resolve fail automatically if it previously failed?
Agent.prototype.dispatch = function(req) {
	if (!req) req = {};
	if (!req.headers) req.headers = {};
	var self = this;

	if (this.requestDefaults)
		copyDefaults(req, this.requestDefaults);

	// If given a request, streaming may occur. Suspend events on the request until resolved, as the dispatcher wont wire up until after resolution.
	if (req instanceof Request) {
		req.suspendEvents();
	}

	// Resolve our target URL
	return ((req.url) ? promise(req.url) : this.resolve({ noretry: req.noretry, nohead: true }))
		.succeed(function(url) {
			req.url = url;
			var res_ = dispatch(req);
			if (req instanceof Request) {
				req.resumeEvents();
			}
			return res_;
		})
		.succeed(function(res) {
			// After every successful request, update our links and mark our context as good (in case it had been bad)
			self.context.setResolved();
			if (res.parsedHeaders.link) self.links = res.parsedHeaders.link;
			else self.links = self.links || []; // cache an empty link list so we dont keep trying during resolution
			self.proxyTmpl = (res.header('Proxy-Tmpl')) ? res.header('Proxy-Tmpl').split(' ') : null;
			return res;
		})
		.fail(function(res) {
			// Let a 1 or 404 indicate a bad context (as opposed to some non-navigational error like a bad request body)
			if (res.status === constants.LINK_NOT_FOUND || res.status === 404)
				self.context.setFailed(res);
			throw res;
		});
};

// Executes a GET text/event-stream request to our context
Agent.prototype.subscribe = function(req) {
	var self = this;
	var eventStream;
	if (!req) req = {};
	return this.resolve({ nohead: true }).succeed(function(url) {
		req.url = url;

		if (self.requestDefaults)
			copyDefaults(req, self.requestDefaults);

		eventStream = subscribe(req);
		return eventStream.response_;
	}).then(function() {
		return eventStream;
	});
};

// Follows a link relation from our context, generating a new agent
// - `query` may be:
//   - an object in the same form of a `local.queryLink()` parameter
//   - an array of link query objects (to be followed sequentially)
//   - a URI string
//     - if using the 'nav:' scheme, will convert the URI into a link query object
//     - if a relative URI using the HTTP/S/L scheme, will follow the relation relative to the current context
//     - if an absolute URI using the HTTP/S/L scheme, will go to that URI
// - uses URI Templates to generate URLs
// - when querying, only the `rel` and `id` (if specified) attributes must match
//   - the exception to this is: `rel` matches and the HREF has an {id} token
//   - all other attributes are used to fill URI Template tokens and are not required to match
Agent.prototype.follow = function(query) {
	// convert nav: uri to a query array
	if (typeof query == 'string' && helpers.isNavSchemeUri(query))
		query = helpers.parseNavUri(query);

	// make sure we always have an array
	if (!Array.isArray(query))
		query = [query];

	// build a full follow() chain
	var nav = this;
	do {
		nav = new Agent(new AgentContext(query.shift()), nav);
		if (this.requestDefaults)
			nav.setRequestDefaults(this.requestDefaults);
	} while (query[0]);

	return nav;
};

// Resets the agent's resolution state, causing it to reissue HEAD requests (relative to any parent agents)
Agent.prototype.unresolve = function() {
	this.context.resetResolvedState();
	this.links = null;
	this.proxyTmpl = null;
	return this;
};

// Reassigns the agent to a new absolute URL
// - `url`: required string, the URL to rebase the agent to
// - resets the resolved state
Agent.prototype.rebase = function(url) {
	this.unresolve();
	this.context.query = url;
	this.context.queryIsAbsolute = true;
	this.context.url  = url;
	this.context.urld = helpers.parseUri(url);
	return this;
};

// Resolves the agent's URL, reporting failure if a link or resource is unfound
//  - also ensures the links have been retrieved from the context
//  - may trigger resolution of parent contexts
//  - options is optional and may include:
//    - noretry: bool, should the url resolve fail automatically if it previously failed?
//    - nohead: bool, should we issue a HEAD request once we have a URL? (not favorable if planning to dispatch something else)
//  - returns a promise which will fulfill with the resolved url
Agent.prototype.resolve = function(options) {
	var self = this;
	options = options || {};

	var nohead = options.nohead;
	delete options.nohead;
	// ^ pull `nohead` out so that parent resolves are `nohead: false` - we do want them to dispatch HEAD requests to resolve us

	var resolvePromise = promise();
	if (this.links !== null && (this.context.isResolved() || (this.context.isAbsolute() && this.context.isBad() === false))) {
		// We have links and we were previously resolved (or we're absolute so there's no need)
		resolvePromise.fulfill(this.context.getUrl());
	} else if (this.context.isBad() === false || (this.context.isBad() && !options.noretry)) {
		// We don't have links, and we haven't previously failed (or we want to try again)
		this.context.resetResolvedState();

		if (this.context.isRelative() && !this.parentAgent) {
			// Scheme-less URIs can map to local URIs, so make sure the local server hasnt been added since we were created
			if (typeof this.context.query == 'string' && !!httpl.getServer(this.context.query)) {
				self.context = new AgentContext(self.context.query);
			} else {
				self.context.setFailed({ status: 404, reason: 'not found' });
				resolvePromise.reject(this.context.getError());
				return resolvePromise;
			}
		}

		if (this.context.isRelative()) {
			// Up the chain we go
			resolvePromise = this.parentAgent.resolve(options)
				.succeed(function() {
					// Parent resolved, query its links
					var childUrl = self.parentAgent.lookupLink(self.context);
					if (childUrl) {
						// We have a pope! I mean, link.
						self.context.setResolved(childUrl);

						// Send a HEAD request to get our links
						if (nohead) // unless dont
							return childUrl;
						return self.dispatch({ method: 'HEAD', url: childUrl })
							.succeed(function() { return childUrl; }); // fulfill resolvePromise afterward
					}

					// Error - Link not found
					var response = new Response();
					response.writeHead(constants.LINK_NOT_FOUND, 'Link Query Failed to Match').end();
					throw response;
				})
				.fail(function(error) {
					self.context.setFailed(error);
					throw error;
				});
		} else {
			// At the top of the chain already
			if (nohead)
				resolvePromise.fulfill(self.context.getUrl());
			else {
				resolvePromise = this.dispatch({ method: 'HEAD', url: self.context.getUrl() })
					.succeed(function(res) { return self.context.getUrl(); });
			}
		}
	} else {
		// We failed in the past and we don't want to try again
		resolvePromise.reject(this.context.getError());
	}
	return resolvePromise;
};

// Looks up a link in the cache and generates the URI (the follow logic)
Agent.prototype.lookupLink = function(context) {
	if (context.query) {
		if (typeof context.query == 'object') {
			// Try to find a link that matches
			var link = helpers.queryLinks(this.links, context.query)[0];
			if (link) {
				var uri = UriTemplate.parse(link.href).expand(context.query);
				if (this.proxyTmpl && !link.noproxy)
					uri = helpers.makeProxyUri(uri, this.proxyTmpl);
				return uri;
			}
		}
		else if (typeof context.query == 'string') {
			// A URL
			if (!helpers.isAbsUri(context.query))
				return helpers.joinRelPath(this.context.urld, context.query);
			return context.query;
		}
	}
	console.log('Failed to find a link to resolve context. Link query:', context.query, 'Agent:', this);
	return null;
};

// Dispatch Sugars
// ===============
function makeDispSugar(method) {
	return function(options) {
		var req = options || {};
		req.method = method;
		return this.dispatch(req);
	};
}
function makeDispWBodySugar(method) {
	return function(body, options) {
		var req = options || {};
		req.method = method;
		req.body = body;
		return this.dispatch(req);
	};
}
Agent.prototype.SUBSCRIBE = makeDispSugar('SUBSCRIBE');
Agent.prototype.HEAD   = Agent.prototype.head   = makeDispSugar('HEAD');
Agent.prototype.GET    = Agent.prototype.get    = makeDispSugar('GET');
Agent.prototype.DELETE = Agent.prototype.delete = makeDispSugar('DELETE');
Agent.prototype.POST   = Agent.prototype.post   = makeDispWBodySugar('POST');
Agent.prototype.PUT    = Agent.prototype.put    = makeDispWBodySugar('PUT');
Agent.prototype.PATCH  = Agent.prototype.patch  = makeDispWBodySugar('PATCH');
Agent.prototype.NOTIFY = Agent.prototype.notify = makeDispWBodySugar('NOTIFY');

// Builder
// =======
var agent = function(query) {
	if (query instanceof Agent)
		return query;

	// convert nav: uri to a query array
	if (typeof query == 'string' && helpers.isNavSchemeUri(query))
		query = helpers.parseNavUri(query);

	// make sure we always have an array
	if (!Array.isArray(query))
		query = [query];

	// build a full follow() chain
	var nav = new Agent(new AgentContext(query.shift()));
	while (query[0]) {
		nav = new Agent(new AgentContext(query.shift()), nav);
	}

	return nav;
};

module.exports = {
	Agent: Agent,
	agent: agent
};