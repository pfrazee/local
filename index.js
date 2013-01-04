// helpers
function $reqbody(body, type) {
	type = (type || ((typeof body == 'string') ? 'text/plain' : 'application/json' ));
	return { body:body, headers:{ 'content-type':type }};
}
function logError(err) {
	if (err.request) { console.log(err.message, err.request); }
	else { console.log(err.message);}
	return err;
}

// request override
var reqLog = new Link.Navigator('httpl://request-log.util');
Environment.request = function(origin, request) {
	// make any connectivity / permissions decisions here

	// pass on to the request log
	if (request.url.indexOf('httpl://request-log.util') === -1) {
		var entry = $reqbody([
			request.method.toUpperCase()+':',
			request.url,
			'<span style="color:gray">',request.headers.accept,'</span>'
		].join(' '));
		reqLog.post(entry, null, logError);
	}

	// allow request
	var response = Link.request(request);
	response.except(logError);
	return response;
};

// client toolbars
var toolbars = document.querySelectorAll('.client-toolbar');
function makeActiveToolbar(elem) {
	elem.innerHTML = '<a href="javascript:void(0)" title="Edit Source"><img src="/assets/icons/16x16/script_code.png"/></a>';
	elem.querySelector('a').addEventListener('click', function(e) {
		e.preventDefault();
		e.stopPropagation();
		// issue request
		Environment.getClient(elem.dataset.client).request({
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
Environment.addServer('intro.doc', new Environment.WorkerServer({ scriptUrl:'/apps/doc/intro.js' }));
Environment.addServer('lib.doc', new Environment.WorkerServer({ scriptUrl:'/apps/doc/lib.js' }));
Environment.addServer('request-log.util', new Environment.WorkerServer({ scriptUrl:'/apps/util/log.js', title:'request log' }));

// load client regions
Environment.addClient('intro').request('httpl://intro.doc');
Environment.addClient('lib').request('httpl://lib.doc/linkjs');
Environment.addClient('request-log').request('httpl://request-log.util');