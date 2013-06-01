var config = local.worker.config;
var templates = {};
function loadTemplate(tmpl, path) {
	templates[tmpl] = '';
	local.web.dispatch(path).succeed(function(response) {
		console.log('got template', response)
		response.on('data', function(data) { console.log('got data',data);templates[tmpl] += data; });
	});
}
loadTemplate('httpl',  'servers/worker/templates/features-httpl.html');
loadTemplate('httpl2', 'servers/worker/templates/features-httpl-posted.html');
loadTemplate('app',    'servers/worker/templates/features-app.html');
loadTemplate('env',    'servers/worker/templates/features-env.html');
loadTemplate('more',   'servers/worker/templates/features-more.html');

// live update list
var theList = [
	'bounded', 'civic', 'confined', 'district', 'divisional', 'geographical', 'insular', 'legendary',
	'limited', 'narrow', 'neighborhood', 'parish', 'parochial', 'provincial', 'regional', 'sectarian',
	'sectional', 'small-town', 'territorial', 'town', 'vernacular'
];

// local storage nav
var localStorageCollection = local.web.navigator('httpl://localstorage.env').collection('features-test');

// route handler
function main(request, response) {
	switch (request.path) {
		case '/httpl':
		default:
			var tmpl = (/post/i.test(request.method)) ? 'httpl2' : 'httpl';
			if (request.body && request.body.checks)
				request.body.checks = request.body.checks.join(', ');
			response.writeHead(200, 'ok', {'content-type':'text/html'});
			renderTemplate(response, tmpl, request.body, 'httpl');
			break;
		case '/app':
			if (/html-deltas/.test(request.headers.accept)) {
				response.writeHead(200, 'ok', {'content-type':'application/html-deltas+json'});
				response.end(['replace', '.list-container', makeList(request.query.filter||'')]);
			} else {
				response.writeHead(200, 'ok', {'content-type':'text/html'});
				renderTemplate(response, 'app', {domain:config.domain, list:makeList(), filter:(request.query.filter||'')});
			}
			break;
		case '/env':
			local.promise((function() {
				// POST request?
				if (/post/i.test(request.method)) {
					if (request.body['delete']) { // delete button?
						// delete the entry
						var targetId = request.body['delete'];
						return localStorageCollection.item(targetId).delete();
					} else {
						// add a new entry
						return localStorageCollection.post({});
					}
				}
				// GET request, do nothing this step
				return true;
			})())
			.succeed(function(res) {
				return localStorageCollection.getJson();
			})
			.succeed(function(res) {
				response.writeHead(200, 'ok', {'content-type':'text/html'});
				renderTemplate(response, 'env', {domain:config.domain, entry:res.body});
			})
			.fail(function() {
				response.writeHead(502, 'bad gateway');
				response.end();
			});
			break;
		case '/more':
			response.writeHead(200, 'ok', {'content-type':'text/html'});
			renderTemplate(response, 'more', {domain:config.domain});
			break;
	}
}

// html builders
function makeNavLi(a, b, label) {
	return '<li{{active}}><a href="httpl://{{domain}}/{{path}}">{{label}}</a></li>'
		.replace('{{active}}', (a == b) ? ' class="active"' : '')
		.replace('{{domain}}', config.domain)
		.replace('{{path}}', b)
		.replace('{{label}}', label);
}

function makeNav(tab) {
	tab = tab || 'httpl';
	return '<ul class="nav nav-pills">{{1}}{{2}}{{3}}{{4}}</ul>'
		.replace('{{1}}', makeNavLi(tab,'httpl','HTTPL'))
		.replace('{{2}}', makeNavLi(tab,'app','Applications'))
		.replace('{{3}}', makeNavLi(tab,'env','The Page'))
		.replace('{{4}}', makeNavLi(tab,'more','Learn More'));
}

function makeList(filter) {
	return (
	'<ul class="unstyled">'+
		theList.filter(function(item) {
			return !filter || item.indexOf(filter) != -1;
		}).map(function(item) {
			return '<li>'+item+'</li>';
		}).join('')+
	'</ul>'
	);
}

function renderTemplate(response, tmpl, context, tab) {
	if (!tab) tab = tmpl;
	if (!context) context = {};
	context.domain = config.domain;

	var html = templates[tmpl];
	console.log(templates, tmpl, html)
	if (html) {
		for (var k in context) {
			if (Array.isArray(context[k]) === false) {
				var substituteRE = new RegExp('{{'+k+'}}', 'gi');
				html = html.replace(substituteRE, context[k]);
			} else {
				var subtemplateRE = new RegExp('{{'+k+':((.|[\r\n])*):'+k+'}}', 'gi');
				html = html.replace(subtemplateRE, function(_,subtemplate) {
					return context[k].map(function(subcontext) {
						var subhtml = ''+subtemplate;
						for (var k2 in subcontext) {
							var substituteRE = new RegExp('{{'+k2+'}}', 'gi');
							subhtml = subhtml.replace(substituteRE, subcontext[k2]);
						}
						return subhtml;
					}).join('');
				});
			}
		}
		html = html.replace(/\{\{.*\}\}/g, '');
		response.end(makeNav(tab) + html);
	} else {
		response.end(makeNav(tab) + 'failed to load html for '+tmpl);
	}
}