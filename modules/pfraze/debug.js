var server = {
	routes:[
		HttpRouter.route('hello', { uri:'^/?$', method:'get', accept:'text/html' }),
		HttpRouter.route('subhello', { uri:'^/sub$', method:'get', accept:'text/html' })
	],
	hello:function() {
		setTimeout(function() {
			Agent.dispatch({ method:'delete', uri:'#/dom/debug/test/0-2/class' });
		}, 100);
		return HttpRouter.response(200, '<div class="test">hello 1</div><div class="test">hello 2</div><div class="test">hello 3</div>', 'text/html');
	}
};
Util.logMode('debug-agent', true);
//Util.logMode('routing', true);
Agent.addServer('#/', server);

postEventMsg('ready');
