
function logError(err) {
	console.log(err.message);
}

// request override
Environment.request = function(origin, request) {
	// make any connectivity / permissions decisions here

	// pass on to the request-stream
	if (request.url.indexOf('httpl://request-stream.ui') === -1) {
		Link.request({ method:'post', url:'httpl://request-stream.ui', body:request })
			.except(logError);
	}

	// allow request
	return Link.request(request);
};

// instantiate services
//Environment.addServer('localstorage.env', new LocalStorageServer()); :TODO:

// instantiate apps
Environment.addServer('intro.doc', new Environment.WorkerServer('/apps/doc/intro.js'));
Environment.addServer('lib.doc', new Environment.WorkerServer('/apps/doc/lib.js'));
Environment.addServer('request-stream.ui', new Environment.WorkerServer('/apps/widgets/request-stream.js'));

// load client regions
Environment.addClient('#intro').request('httpl://intro.doc');
Environment.addClient('#lib').request('httpl://lib.doc/linkjs');
Environment.addClient('#request-stream').request('httpl://request-stream.ui');