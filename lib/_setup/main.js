// Enable any log modes you need here
// (you can define your own modes, then log using Util.log(mode_name, message...))
Util.logMode('traffic', true); // all traffic handled by Env.router
Util.logMode('sessions', true); // any important notices regarding sessions
Env.init({
	getContainerElem:function() { return document.getElementById('env'); },
	init:function() {
		// Load any agent programs you need here
		var a = Env.makeAgent('welcome', { noclose:true });
		a.loadProgram('/host/welcome.js', {
			// this object is passed to the program as configuration
			message:'Welcome to the Link Application Platform!'
		});
	},
	requestSession:function(agent, uri, cb) {
		// Add your session-granting policies here
		if (uri.host == agent.getDomain()) {
			cb(true, ['control']);
		} else if (/\.env$/.test(uri.host)) {
			cb(true);
		} else {
			cb(false);
		}
	},
	requestAuth:function(auth, cb) {
		// Add your credential-granting policies here
		switch (auth.challenge.scheme) {
			case 'LAPSession':
				auth.session.addPerms(auth.challenge.perms); // :DEBUG: just give them what they ask
				cb(true);
				break;
			default:
				console.log("unsupported auth scheme '"+auth.challenge.scheme+"'");
				cb(false);
		}
	}
});