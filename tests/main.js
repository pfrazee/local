// == SECTION Environment

var agent1;
var grant_session = false;
var grant_perm_foobar = false;
//Util.logMode('traffic', true);
Env.init({
	getContainerElem:function() { return document.getElementById('env'); },
	init:function() {
		agent1 = Env.makeAgent('prog1', { noclose:true });
		agent1.loadProgram('/tests/usr/prog1.js', {
			message:'hello world'
		});
	},
	requestSession:function(agent, uri, cb) {
		if (uri.host == agent.getDomain()) {
			cb(true, ['control']);
		} else if (/\.env$/.test(uri.host)) {
			cb(true);
		} else {
			cb(grant_session);
		}
	},
	requestAuth:function(auth, cb) {
		switch (auth.challenge.scheme) {
			case 'LAPSession':
				if (grant_perm_foobar) {
					auth.session.addPerms('foobar');
					cb(true);
				} else {
					cb(false);
				}
				break;
			default:
				throw "unsupported auth scheme '"+auth.challenge.scheme+"'";
		}
	}
});

var __test1_is_ready = false;
function test1_is_ready() {
	return __test1_is_ready;
}
Promise.when(agent1.program_load_promise, function() {
	Env.router.dispatch({ method:'get', uri:'lap://prog1.ui/app', accept:'text/plain' }).then(function(res) {
		print(res.body);
		__test1_is_ready = true;
	});
});
wait(test1_is_ready);
// => hello world
var __test2_is_ready = false;
function test2_is_ready() {
	return __test2_is_ready;
}
var agent2 = Env.makeAgent('prog2', { noclose:true });
agent2.loadProgram('/tests/usr/prog2.js').then(function() {
	agent2.emitDomRequestEvent({ method:'get', uri:'lap://prog1.ui/app', accept:'text/plain' });
	setTimeout(function() {
		Env.router.dispatch({ method:'get', uri:'lap://prog2.ui/app', accept:'text/plain' }).then(function(res) {
			print(res.body);
			__test2_is_ready = true;
		});
	}, 50);
});
wait(test2_is_ready);
// => forbidden
var __test3_is_ready = false;
function test3_is_ready() {
	return __test3_is_ready;
}
grant_session = true;
agent2.emitDomRequestEvent({ method:'get', uri:'lap://prog1.ui/app', accept:'text/plain' });
setTimeout(function() {
	Env.router.dispatch({ method:'get', uri:'lap://prog2.ui/app', accept:'text/plain' }).then(function(res) {
		print(res.body);
		__test3_is_ready = true;
	});
}, 50);
wait(test3_is_ready);
// => hello world
var __test4_is_ready = false;
function test4_is_ready() {
	return __test4_is_ready;
}
agent2.emitDomRequestEvent({ method:'get', uri:'lap://prog1.ui/app/secret', accept:'text/plain' });
setTimeout(function() {
	Env.router.dispatch({ method:'get', uri:'lap://prog2.ui/app', accept:'text/plain' }).then(function(res) {
		print(res.body);
		__test4_is_ready = true;
	});
}, 50);
wait(test4_is_ready);
// => forbidden
var __test5_is_ready = false;
function test5_is_ready() {
	return __test5_is_ready;
}
grant_perm_foobar = true;
agent2.emitDomRequestEvent({ method:'get', uri:'lap://prog1.ui/app/secret', accept:'text/plain' });
setTimeout(function() {
	Env.router.dispatch({ method:'get', uri:'lap://prog2.ui/app', accept:'text/plain' }).then(function(res) {
		print(res.body);
		__test5_is_ready = true;
	});
}, 50);
wait(test5_is_ready);
// => the secret