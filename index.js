// request wrapper
var reqLog = local.http.ext.navigator('httpl://request-log.util');
local.env.setDispatchWrapper(function(request, origin, dispatch) {
	// make any connectivity / permissions decisions here

	// pass on to the request log
	var isLoggerMsg = request.url.indexOf('httpl://request-log.util') !== -1;
	if (!isLoggerMsg) {
		var entry =[
			request.method.toUpperCase()+':',
			request.url,
			'<span style="color:gray">',request.headers.accept,'</span>'
		].join(' ');
		reqLog.post(entry, 'text/plain').fail(console.log.bind(console), request);
	}

	// allow request
	var response = dispatch(request);
	if (!isLoggerMsg) {
		response.succeed(console.log.bind(console, request));
		response.fail(console.log.bind(console, request));
	}
	return response;
});

// client toolbars
var toolbars = document.querySelectorAll('.client-toolbar');
function makeActiveToolbar(elem) {
	elem.innerHTML = '<a href="javascript:void(0)" title="Edit Source"><img src="assets/icons/16x16/script_code.png"/></a>';
	elem.querySelector('a').addEventListener('click', function(e) {
		e.preventDefault();
		e.stopPropagation();
		// issue request
		local.env.getClientRegion(elem.dataset.client).dispatchRequest({
			method:'get',
			url:'httpl://servers.env/'+elem.dataset.client+'.doc/editor',
			headers:{ accept:'text/html' }
		});
	});
}
for (var i=0; i < toolbars.length; i++) {
	makeActiveToolbar(toolbars[i]);
}

// instantiate services
local.env.addServer('localstorage.env', new StorageServer(localStorage));
local.env.addServer('servers.env', new ReflectorServer());

// instantiate apps
local.env.addServer('intro.doc', new local.env.WorkerServer({ scriptUrl:'../servers/worker/intro.js' }));
local.env.addServer('features.doc', new local.env.WorkerServer({ scriptUrl:'../servers/worker/features.js' }));
local.env.addServer('request-log.util', new local.env.WorkerServer({ scriptUrl:'../servers/worker/log.js', title:'request log' }));

// load client regions
local.env.addClientRegion('intro').dispatchRequest('httpl://intro.doc');
local.env.addClientRegion('features').dispatchRequest('httpl://features.doc');
local.env.addClientRegion('request-log').dispatchRequest('httpl://request-log.util');