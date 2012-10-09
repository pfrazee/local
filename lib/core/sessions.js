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
		Sessions.addAuthScheme('LAPSession', LAPSessionAuth);
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
		this.perms = [];
	}
	Session.prototype.getAuth = function Session__getAuth(scheme_name) {
		var scheme = Sessions.getAuthScheme(scheme_name || this.authscheme);
		return scheme(this);
	};
	Session.prototype.addPerms = function Session__addPerms(perms) {
		this.perms = this.perms.concat(perms).reduce(__unique, []);
	};
	Session.prototype.delPerms = function Session__delPerms(perms) {
		perms = (Array.isArray(perms)) ? perms : [perms];
		this.perms = this.perms.filter(function (v) {
			return (perms.indexOf(v) == -1);
		});
	};
	Session.prototype.hasPerms = function Session__hasPerms(perms) {
		perms = (Array.isArray(perms)) ? perms : [perms];
		var allfound = perms.every(function(v) {
			return this.perms.indexOf(v) != -1;
		}, this);
		return allfound;
	};

	function __unique(acc, v) {
		if (acc.indexOf(v) == -1) {
			acc.push(v);
		}
		return acc;
	}

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

	// LinkAP Session Auth Scheme
	// =============================
	function LAPSessionAuth(session) {
		var header = {
			scheme:'LAPSession',
			id:session.id,
			agent:session.agent_id,
			perms:session.perms || []
		};
		Object.defineProperty(header, 'toString', { value:stringLAPSession });
		return header;
	}
	function stringLAPSession() {
		return 'LAPSession id='+this.id+' agent='+this.agent+' perms='+this.perms.join(',');
	}
	
	return Sessions;
})();
