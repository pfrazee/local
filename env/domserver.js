if (typeof DomServer == 'undefined') {
	(function() {
		globals.DomServer = function() {

		};

		DomServer.prototype.routes = [
			HttpRouter.route('getHtml', { method:'get', uri:urimatch('^/:agent/:class?/:range?/?$'), accept:'text/.*' }),
			HttpRouter.route('setHtml', { method:'put', uri:urimatch('^/:agent/:class?/:range?/?$'), 'content-type':'text/.*' }),
			HttpRouter.route('insertNode', { method:'post', uri:urimatch('^/:agent/:class/:range/:position/:position_param?/?$'), 'content-type':'text/.*' }),
			HttpRouter.route('deleteNode', { method:'delete', uri:urimatch('^/:agent/:class/:range?/?$') }),

			HttpRouter.route('getAttrText', { method:'get', uri:urimatch('^/:agent/:class/:range/:attr?$'), accept:'text/.*' }),
			HttpRouter.route('getAttrJson', { method:'get', uri:urimatch('^/:agent/:class/:range/:attr?$'), accept:'application/json' }),
			HttpRouter.route('setAttrText', { method:'put', uri:urimatch('^/:agent/:class/:range/:attr?$'), 'content-type':'text/.*' }),
			HttpRouter.route('setAttrJson', { method:'put', uri:urimatch('^/:agent/:class/:range/:attr?$'), 'content-type':'application/json' }),
			HttpRouter.route('clearAttr', { method:'delete', uri:urimatch('^/:agent/:class/:range/:attr?$') })
		];

		DomServer.prototype.getHtml = function getHtml(request, match) {
			// :TODO: validate access with session
			
			var nodes = getNodes(match);
			if (nodes.length == 0) {
				return HttpRouter.response(404, 0, 0, { reason:'node(s) not found' });
			}

			var html = '';
			nodes.forEach(function(node) {
				html += node.innerHTML;
			});

			return HttpRouter.response(200, html, 'text/html', { reason:'ok' });
		};

		DomServer.prototype.setHtml = function setHtml(request, match) {
			// :TODO: validate access with session
			
			var nodes = getNodes(match);
			if (nodes.length == 0) {
				return HttpRouter.response(404, 0, 0, { reason:'node(s) not found' });
			}

			var html = request.body ? request.body.toString() : '';
			nodes.forEach(function(node) {
				node.innerHTML = html;
			});

			return HttpRouter.response(200, 0, 0, { reason:'ok' });
		};

		DomServer.prototype.insertNode = function insertNode(request, match) {
			// :TODO: validate access with session
			
			var nodes = getNodes(match);
			if (nodes.length == 0) {
				return HttpRouter.response(404, 0, 0, { reason:'node(s) not found' });
			}
			var position = match.uri[4];
			var position_param = match.uri[5] || 0;

			var html = request.body ? request.body.toString() : '';
			nodes.forEach(function(node) {
				var el = document.createElement('div');
				el.innerHTML = html;

				var frag = document.createDocumentFragment();
				while (el.childNodes.length) {
					var chel = el.removeChild(el.childNodes[0]);
					frag.appendChild(chel);
				}

				switch (position) {
					case 'before':
						node.insertBefore(frag, node.childNodes[position_param]);
						break;
					case 'replace':
						node.replaceChild(frag, node.childNodes[position_param]);
						break;
					case 'append':
					default:
						node.appendChild(frag);
						break;
				}
			});

			return HttpRouter.response(200, 0, 0, { reason:'ok' });
		};

		DomServer.prototype.deleteNode = function deleteNode(request, match) {
			// :TODO: validate access with session

			var nodes = getNodes(match);
			if (nodes.length == 0) {
				return HttpRouter.response(404, 0, 0, { reason:'node(s) not found' });
			}

			nodes.forEach(function(node) {
				node.parentNode.removeChild(node);
			});

			return HttpRouter.response(200, 0, 0, { reason:'ok' });
		};

		DomServer.prototype.getAttrText = function getAttrText(request, match) {
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
		};
		
		function getNodes(match) {
			var agent = document.getElementById('agent-'+match.uri[1]);
			if (!agent) { return []; }

			var nodes = agent.getElementsByClassName(match.uri[2]);
			var lo=0, hi=nodes.length-1;
			var rangematch = /([0-9]+)(?:\-([0-9]+))?/.exec(match.uri[3]);
			if (rangematch) {
				lo = parseInt(rangematch[1]);
				hi = parseInt(rangematch[2] || rangematch[1]);
			}
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