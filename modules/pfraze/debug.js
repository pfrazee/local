// server
var server = {
	routes:[
		HttpRouter.route('hello', { uri:'^/?$', method:'get', accept:'text/html' }),
		HttpRouter.route('subhello', { uri:'^/sub$', method:'get', accept:'text/html' })
	],
	hello:function() {
		return HttpRouter.response(200, '<a href="#/debug/sub">link</a>', 'text/html');
	},
	subhello:function() {
		return HttpRouter.response(200, 'link clicked! <script class="program" src="/modules/pfraze/debug.js"></script>', 'text/html');
	}
};
Agent.addServer('#/', server);

// client
addEventMsgListener('dom:request', function(e) {
	Agent.follow(e.request);
});
addEventMsgListener('dom:response', function(e) {
	Agent.dispatch({ method:'put', uri:'#/dom/debug', 'content-type':'text/html', body:e.response.body });
});

postEventMsg('ready');
