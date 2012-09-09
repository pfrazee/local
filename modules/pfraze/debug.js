importScripts('/stdlib/agent.js');

var server = {
	routes:[
		HttpRouter.route('hello', { uri:'^/?$', method:'get', accept:'text/html' })
	],
	hello:function() {
		return HttpRouter.response(200, '<h1>hello from debug.js!!</h1>', 'text/html');
	}
};
Agent.io.addModule('/', server);

postEventMsg('ready');
