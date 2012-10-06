var Sessions = (function() {
	// Sessions
	// ========
	// manages agent sessions
	var Sessions = {
		make:Sessions__make,
		isa:Sessions__isa
	};
	var __uidcounter = 1;

	function Sessions__make(protocol, agent) {
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

	function Sessions__isa(obj) {
		return (
			obj.getAuthHeader !== undefined &&
			obj.hasPerm !== undefined &&
			obj.addPerm !== undefined &&
			obj.delPerm !== undefined
		);
	}

	// Auth Schemes
	// ============

	// Basic
	function Basic(id, agent) {
		this.id = id;
		this.username = '';
		this.password = '';
	}
	Basic.prototype.getAuthHeader = function Basic__getAuthHeaderfunction() {
		var header = {
			scheme:'Basic',
			username:this.username,
			password:this.password
		};
		Object.defineProperty(header, 'toString', { value:stringBasic });
		return header;
	};
	function stringBasic() {
		if (!this.username) { return null; }
		return 'Basic '+/*toBase64 :TODO:*/(this.username+':'+this.password);
	}
	Basic.prototype.hasPerm = function Basic__hasPerm(perm) {
		return true; // :TODO:
	};
	Basic.prototype.addPerm = function Basic__addPerm(perm) {};
	Basic.prototype.delPerm = function Basic__delPerm(perm) {};

	// LinkSHell Session
	function LSHSession(id, agent) {
		this.id = id;
		this.agent = agent.getId();
		this.perms = [];
	}
	LSHSession.prototype.getAuthHeader = function LSHSession__getAuthHeader() {
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
	LSHSession.prototype.hasPerm = function LSHSession__hasPerm(perm) {
		return this.perms.indexOf(perm) != -1;
	};
	LSHSession.prototype.addPerm = function LSHSession__addPerm(perm) {
		if (!this.hasPerm(perm)) {
			this.perms.push(perm);
		}
	};
	LSHSession.prototype.delPerm = function LSHSession__delPerm(perm) {
		this.perms.splice(this.perms.indexOf(perm), 1);
	};
	
	return Sessions;
})();
