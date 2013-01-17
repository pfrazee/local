Example: env/persona.js
=======================

pfraze 2013


## Overview

Persona.js shows how a session can be managed. It provides widgets to simplify application usage, and broadcasts events so applications can respond to session changes.


## persona.js

```javascript
// persona.js
// user-session controls using mozilla's persona

// current user (likely an email)
Environment.user = null;

// Widgets
// =======
// "log in / <username> log out"
function addPersonaCtrls(elem) {
	var ctrls = elem.querySelectorAll('.persona-ctrl');
	for (var i=0, ii=ctrls.length; i < ii; i++) {
		var ctrl = ctrls[i];
		if (Environment.user) {
			// logged in
			ctrl.innerHTML = [
				'<span class="label">',
					Environment.user.name,
				'</span>',
				' <a href="javascript:void(0)">Sign Out</a>'
			].join('');
			ctrl.addEventListener('click', function(e) {
				navigator.id.logout();
				e.preventDefault();
				e.stopPropagation();
			});
		} else {
			// logged out
			ctrl.innerHTML = [
				'<a href="javascript:void(0)">',
					'<span class="label label-info">Sign in using BrowserID</span>',
				'</a>'
			].join('');
			ctrl.addEventListener('click', function(e) {
				navigator.id.request();
				e.preventDefault();
				e.stopPropagation();
			});
		}
	}
}

// Server
// ======
function PersonaServer() {
	Environment.Server.call(this);
	this.state = Environment.Server.ACTIVE;
	this.userBroadcast = Link.broadcaster();

	// start watching for persona events
	navigator.id.watch({
		loggedInUser:(Environment.user) ? Environment.user.name : null,
		onlogin:this.onLogin.bind(this),
		onlogout:this.onLogout.bind(this)
	});
}
PersonaServer.prototype = Object.create(Environment.Server.prototype);

// persona login handler
PersonaServer.prototype.onLogin = function(assertion) {
	// verify the login assertion with the auth server
	// :DEBUG: need to pull out the verify address
	var self = this;
	Link.dispatch({
		method:'post',
		url:'http://'+window.location.host+'/persona-verify.php',
		headers:{ accept:'application/json', 'content-type':'application/x-www-form-urlencoded' },
		body:{ audience:'http://linkapjs.com:81', assertion:assertion }
	}).then(function(res) {
		if (res.body.status == 'okay') {
			// logged in
			Environment.user = { scheme:'persona', name:res.body.email, assertion:assertion };
			// tell the world
			self.userBroadcast.emit('login', Environment.user.name);
		} else {
			// login failure
			Environment.user = null;
			console.log('failed to verify identity assertion', res.body);
		}
		// recreate all controls
		addPersonaCtrls(document.body);
		return res;
	}).except(function(err) {
		// login failure
		console.log('failed to verify identity assertion', err.message);
		Environment.user = null;
		// recreate all controls
		addPersonaCtrls(document.body);
		// tell the world
		self.userBroadcast.emit('logout');
		return err;
	});
};

// persona logout handler
PersonaServer.prototype.onLogout = function() {
	// logged out
	Environment.user = null;
	// recreate all controls
	addPersonaCtrls(document.body);
	// tell the world
	this.userBroadcast.emit('logout');
};

// request router
PersonaServer.prototype.handleHttpRequest = function(request, response) {
	var self = this;
	var router = Link.router(request);
	var respond = Link.responder(response);
	router.a(/event-stream/, function() {
		// add the broadcast subscriber
		respond.ok('event-stream');
		self.userBroadcast.addStream(response);
		self.userBroadcast.emitTo(response, 'subscribe', Environment.user ? Environment.user.name : null);
	});
	if (!router.isRouted) {
		respond.ok('text/plain').end(Environment.user ? Environment.user.name : null);
	}
};
```