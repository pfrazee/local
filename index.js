// request wrapper
var reqLog = new Link.Navigator('httpl://request-log.util');
Environment.setDispatchHandler(function(origin, request) {
	// make any connectivity / permissions decisions here

	// pass on to the request log
	if (request.url.indexOf('httpl://request-log.util') === -1) {
		var entry =[
			request.method.toUpperCase()+':',
			request.url,
			'<span style="color:gray">',request.headers.accept,'</span>'
		].join(' ');
		reqLog.post(entry, 'text/plain').except(console.log.bind(console), request);
	}

	// allow request
	var response = Link.dispatch(request);
	response.then(console.log.bind(console), request);
	response.except(console.log.bind(console), request);
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
		Environment.getClientRegion(elem.dataset.client).dispatchRequest({
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
Environment.addServer('localstorage.env', new LocalStorageServer());
Environment.addServer('servers.env', new ReflectorServer());

// instantiate apps
Environment.addServer('intro.doc', new Environment.WorkerServer({ scriptUrl:'../apps/doc/intro.js' }));
Environment.addServer('features.doc', new Environment.WorkerServer({ scriptUrl:'../apps/doc/features.js' }));
Environment.addServer('request-log.util', new Environment.WorkerServer({ scriptUrl:'../apps/util/log.js', title:'request log' }));

// load client regions
Environment.addClientRegion('intro').dispatchRequest('httpl://intro.doc');
Environment.addClientRegion('features').dispatchRequest('httpl://features.doc');
Environment.addClientRegion('request-log').dispatchRequest('httpl://request-log.util');