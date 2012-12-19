// create environment
var env = new App.Environment();

// set policies
env.onSessionRequest(function(process, urid, cb) {
	// :TODO:
});
env.onAuthRequest(function(auth, cb) {
	// :TODO:
});

// instantiate apps
env.spawnServer('intro.doc', '/assets/apps/doc/intro.js');
env.spawnServer('lib.doc', '/assets/apps/doc/lib.js');

// load client regions
env.spawnClient('#intro').request('httpl://intro.doc');
env.spawnClient('#lib').request('httpl://lib.doc/linkjs');