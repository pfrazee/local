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
//env.spawnServer('libs.doc', '/assets/apps/doc/libs.js');

// load client regions
env.spawnClient('#intro').request('httpl://intro.doc');
/*env.spawnClient('#common-client').request('httpl://libs.doc/common-client');
env.spawnClient('#myhouse').request('httpl://libs.doc/myhouse');
env.spawnClient('#server-utils').request('httpl://libs.doc/server-utils');
env.spawnClient('#rez-primitives').request('httpl://libs.doc/rez-primitives');
env.spawnClient('#link-ap').request('httpl://libs.doc/link-ap');*/