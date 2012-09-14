// Link Reflector
// ==============
// produces functions from link data

if (typeof ReflectLinks == 'undefined') {
	(function() {
		globals.ReflectLinks = function ReflectLinks(links, static_params) {
			if (!Array.isArray(links)) { links = [links]; }
			var fns = {};
			links.forEach(function(link) {
				var methods = Array.isArray(link.methods) ? link.methods : [link.method];
				if (methods.length == 0) { methods = ['get']; }
				methods.forEach(function(method) {
					var fn_name = method+link.title;
					fn_name = fn_name.replace(/ /g, '_');
					fns[fn_name] = makeFunc(method, link, static_params);
				})
			});
			return fns;
		}
		// moved here to reduce closure size
		function makeFunc(method, link, static_params) {
			return function(params, opt_body, opt_type, opt_headers, opt_follow) {
				var request = opt_headers || {};
				if (opt_body) { request.body = opt_body; }
				if (opt_type) { request['content-type'] = opt_type; }

				params = params || {};
				for (var k in static_params) {
					if (!(k in params)) {
						params[k] = static_params[k];
					}
				}

				var href_parts = link.href.split('?');
				var uri = href_parts[0]; 
				var query = href_parts[1];
				for (var k in params) {
					uri = uri.replace('{'+k+'}', params[k]);
					if (query) {
						query = query.replace('{'+k+'}', k+'="'+params[k]+'"');
					}
				}
				request.uri = uri.replace(/\{.*\}/g, '');
				if (query) {
					query = query
						.replace(/\{[A-z0-9]*\}/g, '') // empty {}s
						.replace(/&+/g,'&') // repeating &s
						.replace(/^&/,'') // & at beginning
						.replace(/&$/,''); // & at end
					request.uri += '?' + query;
				}

				if (!request.method) {
					request.method = method;
				}
				if (!request.accept && link.type) {
					request.accept = link.type;
				}

				return Agent.dispatch(request, opt_follow);
			};
		}
	})();
}