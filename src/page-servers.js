var httpl   = require('./web/httpl');
var helpers = require('./web/helpers');
var promise = require('./promises').promise;

// Helper to only allow HEAD/GET
function readOnly(req, res) {
	if (['HEAD', 'GET'].indexOf(req.method) === -1) {
		res.s405('Bad method').allow('HEAD, GET').end();
		return true;
	}
}

if (typeof self != 'undefined' && typeof self.window !== 'undefined') {
	// Document links
	// ==============
	httpl.at('#localjs/document', function(req, res, origin) {
		if (origin) {
			return res.s403('Only accessible from the document').end();
		}
		if (readOnly(req, res)) return;
		res.s204('Ok, no content').link(helpers.extractDocumentLinks(document, { links: true })).end();
	});

	// Parent frame
	// ============
	httpl.at('#localjs/window.parent', function(req, res, origin) {
		if (origin) {
			return res.s403('Only accessible from the document').end();
		}
		if (window.parent === window) {
			return res.s404('No parent frame detected').end();
		}
		res.s501('todo').end(); // :TODO:
	});

	// Opener frame
	// ============
	httpl.at('#localjs/window.opener', function(req, res, origin) {
		if (origin) {
			return res.s403('Only accessible from the document').end();
		}
		if (!window.opener) {
			return res.s404('No opener frame detected').end();
		}
		res.s501('todo').end(); // :TODO:
	});

	// Original host
	// =============
	httpl.at('#localjs/window.location.origin', function(req, res, origin) {
		if (origin) {
			return res.s403('Only accessible from the document').end();
		}
		// Clone request
		var req2 = {};
		for (var k in req) {
			if (req.hasOwnProperty(k)) {
				req2[k] = req[k];
			}
		}
		// Redispatch to host
		req2.url = window.location.origin;
		web.dispatch(req2).pipe(res);
	});

	// Union of environment links
	// ==========================
	var unionEnvLinks_ = null;
	httpl.at('#localjs/env', function(req, res, origin) {
		if (origin) {
			return res.s403('Only accessible from the document').end();
		}
		if (readOnly(req, res)) return;
		if (!unionEnvLinks_) {
			unionEnvLinks_ = promise.bundle([
				// This order determines override importance
				web.head('#localjs/window.parent'), // highest importance
				web.head('#localjs/window.opener'),
				web.head('#localjs/window.location.origin'),
				web.head('#localjs/document') // lowest importance
			]).always(function(ress) {
				// Combine links from all 4 origins, maintaining order
				return ress[0].links.concat(ress[1].links, ress[2].links, ress[3].links);
			});
		}
		unionEnvLinks_.always(function(links) {
			// Respond with links
			res.s204('Ok, no content').link(links).end();
		});
	});
}