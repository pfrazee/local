importScripts('/stdlib/msgevents.js');
importScripts('/stdlib/httpserver.js');

var server = {
	routes:[
		Link.route('hello', { uri:'^/?$', method:'get', accept:'text/html' })
	],
	hello:function() {
		return Link.response(200, '<h1>hello from debug.js!!</h1>', 'text/html');
	}
};
HttpServer.addModule('/', server);

postEventMsg('ready');
