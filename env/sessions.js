var Sessions = (function() {
	// Sessions
	// ========
	// manages agent sessions
	var Sessions = {
		init:Sessions__init,
		make:Sessions__make,

		addAuthScheme:Sessions__addAuthScheme,
		removeAuthScheme:Sessions__removeAuthScheme,
		getAuthScheme:Sessions__getAuthScheme
	};
	var __uidcounter = 1;
	var __auth_schemes = {};

	function Sessions__init() {
		Sessions.addAuthScheme('Basic', BasicAuth);
		Sessions.addAuthScheme('LSHSession', LSHSessionAuth);
	}

	function Sessions__make(agent) {
		var id = __uidcounter++;
		return new Session(id, agent);
	}

	function Sessions__addAuthScheme(name, scheme) {
		__auth_schemes[name] = scheme;
	}

	function Sessions__removeAuthScheme(name) {
		delete __auth_schemes[name];
	}

	function Sessions__getAuthScheme(name) {
		if (!name) { return NoAuth; }
		if (!(name in __auth_schemes)) {
			throw "auth scheme not defined";
		}
		return __auth_schemes[name];
	}

	// Session Prototype
	// =================
	function Session(id, agent) {
		this.id = id;
		this.agent_id = agent.getId();
		this.authscheme = null;
	}
	Session.prototype.getAuth = function Session__getAuth(scheme_name) {
		var scheme = Sessions.getAuthScheme(scheme_name || this.authscheme);
		return scheme(this);
	};

	// No Auth Scheme
	// ==============
	function NoAuth(session) {
		return null;
	}

	// Basic Auth Scheme
	// =================
	function BasicAuth(session) {
		var header = {
			scheme:'Basic',
			username:session.username,
			password:session.password
		};
		Object.defineProperty(header, 'toString', { value:stringBasic });
		return header;
	}
	function stringBasic() {
		if (!this.username) { return ''; }
		return 'Basic '+/*toBase64 :TODO:*/(this.username+':'+this.password);
	}

	// LinkSHell Session Auth Scheme
	// =============================
	function LSHSessionAuth(session) {
		var header = {
			scheme:'LSHSession',
			id:session.id,
			agent:session.agent_id,
			perms:session.perms || []
		};
		Object.defineProperty(header, 'toString', { value:stringLSHSession });
		return header;
	}
	function stringLSHSession() {
		return 'LSHSession id='+this.id+' agent='+this.agent+' perms='+this.perms.join(',');
	}
	
	return Sessions;
})();
