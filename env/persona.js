// persona.js
// unsafe (client-side) user-session controls using mozilla's persona

// Definitions
// ===========
var user = null; // :TODO: initialize with session

// Widgets
// =======
// "log in / <username> log out"
function addPersonaCtrls(elem) {
	var ctrls = elem.querySelectorAll('.persona-ctrl');
	for (var i=0, ii=ctrls.length; i < ii; i++) {
		var ctrl = ctrls[i];
		if (user) {
			// logged in
			ctrl.innerHTML = [
				'<span class="label">',
					user,
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

// Init
// ====
navigator.id.watch({
	loggedInUser: user,
	onlogin: function(assertion) {
		// verify the login assertion with the auth server
		// :DEBUG: need to pull out the verify address
		Link.request({
			method:'post',
			url:'http://'+window.location.host+'/persona-verify.php',
			headers:{ accept:'application/json', 'content-type':'application/x-www-form-urlencoded' },
			body:{ audience:'http://linkapjs.com:81', assertion:assertion }
		}).then(function(res) {
			if (res.body.status == 'okay') {
				// logged in
				user = res.body.email;
			} else {
				// login failure
				user = null;
				console.log('failed to verify identity assertion', res.body);
			}
			// recreate all controls
			addPersonaCtrls(document.body);
			return res;
		}).except(function(err) {
			// login failure
			console.log('failed to verify identity assertion', err.message);
			user = null;
			// recreate all controls
			addPersonaCtrls(document.body);
			return err;
		});
	},
	onlogout: function() {
		// logged out
		user = null;
		// recreate all controls
		addPersonaCtrls(document.body);
	}
});