
function logError(err) {
	console.log(err.message);
}

// request override
Environment.request = function(origin, request) {
	// make any connectivity / permissions decisions here

	// pass on to the request log
	if (request.url.indexOf('httpl://request-log.util') === -1) {
		Link.request({ method:'post', url:'httpl://request-log.util', body:request })
			.except(logError);
	}

	// allow request
	return Link.request(request);
};

// instantiate services
//Environment.addServer('localstorage.env', new LocalStorageServer()); :TODO:

// instantiate apps
Environment.addServer('intro.doc', new Environment.WorkerServer('/apps/doc/intro.js'));
Environment.addServer('libraries.doc', new Environment.WorkerServer('/apps/doc/lib.js'));
Environment.addServer('request-log.util', new Environment.WorkerServer('/apps/util/log.js', { title:'request log' }));

// load client regions
Environment.addClient('#intro').request('httpl://intro.doc');
Environment.addClient('#lib').request('httpl://libraries.doc/linkjs');
Environment.addClient('#request-log').request('httpl://request-log.util');