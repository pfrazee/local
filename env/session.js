var Session = (function() {
	// Session
	// =======
	// manages agent sessions
	var Session = {
		make:Session__make
	};
	var __uidcounter = 1;

	function Session__make(protocol, agent) {
		var id = __uidcounter++;

		switch(protocol) {
			case 'http':
			case 'https':
				return new Basic(id, agent);
			case 'lsh':
				return new LSHSession(id, agent);
		}

		throw "undefined protocol given to session make";
	}

	// Auth Schemes
	// ============

	// Basic
	function Basic(id, agent) {
		this.id = id;
		this.username = '';
		this.password = '';
	}
	Basic.prototype.getAuthHeader = function() {
		var header = {
			scheme:'Basic',
			username:this.username,
			password:this.password,
		};
		Object.defineProperty(header, 'toString', { value:stringBasic });
		return header;
	};
	function stringBasic() {
		if (!this.username) { return null; }
		return 'Basic '+/*toBase64 :TODO:*/(this.username+':'+this.password);
	}

	// LinkSHell Session
	function LSHSession(id, agent) {
		this.id = id;
		this.agent = agent.getId();
		this.perms = [];
	}
	LSHSession.prototype.getAuthHeader = function() {
		var header = {
			scheme:'LSHSession',
			id:this.id,
			agent:this.agent,
			perms:this.perms
		};
		Object.defineProperty(header, 'toString', { value:stringLSHSession });
		return header;
	};
	function stringLSHSession() {
		return 'LSHSession id='+this.id+' agent='+this.agent+' perms='+this.perms.join(',');
	}
	
	return Session;
})();
