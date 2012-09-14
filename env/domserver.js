if (typeof DomServer == 'undefined') {
	(function() {
		globals.DomServer = function() {

		};

		DomServer.prototype.routes = [
			HttpRouter.route('get', { method:'get', uri:'^/([^/]*)/?$', accept:'text/.*' }),
			HttpRouter.route('put', { method:'put', uri:'^/([^/]*)/?$', 'content-type':'text/.*' }),
			HttpRouter.route('ins', { method:'post', uri:'^/([^/]*)/?$', 'content-type':'text/.*' }),
			HttpRouter.route('del', { method:'delete', uri:'^/([^/]*)/?$' }),
			HttpRouter.route('listen', { method:'listen', uri:'^/([^/]*)/([^/]*)/?$' })
		];

		DomServer.prototype.get = function DomServer__get(request, match) {
			var agent = Env.getAgent(match.uri[1]);
			// :TODO: validate access with session
			
			var nodes = getNodes(agent, request.query);
			if (nodes.length == 0) {
				return HttpRouter.response([404,'node(s) not found']);
			}

			var val = '';
			var attr = request.query.attr || 'innerHTML';
			nodes.forEach(function(node) {
				val += node[attr];
			});

			var type = (/html/i.test(attr)) ? 'text/html' : 'text/plain';
			return HttpRouter.response([200,'ok'], val, type);
		};

		DomServer.prototype.put = function DomServer__put(request, match) {
            var agent = Env.getAgent(match.uri[1]);
			// :TODO: validate access with session
			
			var nodes = getNodes(agent, request.query);
			if (nodes.length == 0) {
				return HttpRouter.response([404,'node(s) not found']);
			}

			var val = request.body ? request.body.toString() : '';
            var attr = request.query.attr || 'innerHTML';
			nodes.forEach(function(node) {
				node[attr] = val;
			});

			return HttpRouter.response([200,'ok']);
		};

		DomServer.prototype.ins = function DomServer__ins(request, match) {
            var agent = Env.getAgent(match.uri[1]);
			// :TODO: validate access with session
			
			var nodes = getNodes(agent, request.query);
			if (nodes.length == 0) {
				return HttpRouter.response([404,'node(s) not found']);
			}

			var html = request.body ? request.body.toString() : '';
			nodes.forEach(function(node) {
                // (can't just do frag.innerHTML = html)
				var el = document.createElement('div');
				el.innerHTML = html;
				var frag = document.createDocumentFragment();
				while (el.childNodes.length) {
					var chel = el.removeChild(el.childNodes[0]);
					frag.appendChild(chel);
				}

				var added = false;
                if ('before' in request.query) {
					node.insertBefore(frag, node.childNodes[request.query.before]);
					added = true;
                }
                if ('replace' in request.query) {
					node.replaceChild(frag, node.childNodes[request.query.replace]);
					added = true;
                }
                if (!added || 'append' in request.query) {
					node.appendChild(frag);
				}
			});

			return HttpRouter.response([200,'ok']);
		};

		DomServer.prototype.del = function DomServer__del(request, match) {
            var agent = Env.getAgent(match.uri[1]);
			// :TODO: validate access with session

			var nodes = getNodes(agent, request.query);
			if (nodes.length == 0) {
				return HttpRouter.response([404,'node(s) not found']);
			}

			nodes.forEach(function(node) {
				node.parentNode.removeChild(node);
			});

			return HttpRouter.response([200,'ok']);
		};

		DomServer.prototype.listen = function DomServer__listen(request, match) {
            var agent = Env.getAgent(match.uri[1]);
			// :TODO: validate access with session

			agent.addDomEventHandler(match.uri[2], request.query.qall);

			return HttpRouter.response([200,'ok']);
		};

		/*DomServer.prototype.getAttrText = function getAttrText(request, match) {
			// :TODO: validate access with session
 
			var nodes = getNodes(match);
			if (nodes.length == 0) {
				return HttpRouter.response(404, 0, 0, { reason:'node(s) not found' });
			}
			var attr = match.uri[4];

			var vals = [];
			nodes.forEach(function(node) {
				vals.push(node.getAttribute(attr));
			});
			vals = vals.join("\r\n");

			return HttpRouter.response(200, vals, 'text/plain', { reason:'ok' });
		};

		DomServer.prototype.getAttrJson = function getAttrJson(request, match) {
			// :TODO: validate access with session

			var nodes = getNodes(match);
			if (nodes.length == 0) {
				return HttpRouter.response(404, 0, 0, { reason:'node(s) not found' });
			}
			var attr = match.uri[4];

			var vals = [];
			nodes.forEach(function(node) {
				vals.push(node.getAttribute(attr));
			});

			return HttpRouter.response(200, vals, 'application/json', { reason:'ok' });
		};

		DomServer.prototype.setAttrText = function setAttrText(request, match) {
			// :TODO: validate access with session

			var nodes = getNodes(match);
			if (nodes.length == 0) {
				return HttpRouter.response(404, 0, 0, { reason:'node(s) not found' });
			}
			var attr = match.uri[4];

			nodes.forEach(function(node) {
				node.setAttribute(attr, request.body);
			});

			return HttpRouter.response(200, 0, 0, { reason:'ok' });
		};

		DomServer.prototype.setAttrJson = function setAttrText(request, match) {
			// :TODO: validate access with session

			var nodes = getNodes(match);
			if (nodes.length == 0) {
				return HttpRouter.response(404, 0, 0, { reason:'node(s) not found' });
			}
			var attr = match.uri[4];

			var val = null;
			nodes.forEach(function(node, i) {
				val = request.body[i] || val;
				node.setAttribute(attr, val);
			});

			return HttpRouter.response(200, 0, 0, { reason:'ok' });
		};

		DomServer.prototype.clearAttr = function clearAttr(request, match) {
			// :TODO: validate access with session

			var nodes = getNodes(match);
			if (nodes.length == 0) {
				return HttpRouter.response(404, 0, 0, { reason:'node(s) not found' });
			}
			var attr = match.uri[4];

			nodes.forEach(function(node) {
				node.removeAttribute(attr);
			});

			return HttpRouter.response(200, 0, 0, { reason:'ok' });
		};*/
		
		function getNodes(agent, query) {
			if (!agent) { return []; }

            var body = agent.getBody();
            if (!query || (!query.q && !query.qall)) {
                return [body];
            }

			var nodes = query.qall ? 
				body.querySelectorAll(query.qall) :
				[body.querySelector(query.q)];
			var lo=0, hi=nodes.length-1;
			/*var rangematch = /([0-9]+)(?:\-([0-9]+))?/.exec(match.uri[3]);
			if (rangematch) {
				lo = parseInt(rangematch[1]);
				hi = parseInt(rangematch[2] || rangematch[1]);
			}*/
			var nodearr = [];
			for (var i=lo; i <= hi; i++) {
				if (!nodes[i]) { continue; }
				nodearr.push(nodes[i]);
			}
			return nodearr;
		};

		// helper to make a uri match regexp
		// :TODO: should http router just get this support?
		function urimatch(str) {
			return str
				.replace(/\/\:[A-z]+\?/g, '(?:/([^/]*))?') // optional segment
				.replace(/\/\:[A-z]+/g, '/([^/]*)') // non-optional segment
		}
	})();
}
