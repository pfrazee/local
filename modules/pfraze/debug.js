// server
var server = {
	routes:[
		HttpRouter.route('hello', { uri:'^/?$', method:'get', accept:'text/html' }),
		HttpRouter.route('subhello', { uri:'^/sub$', method:'get', accept:'text/html' })
	],
	hello:function() {
		return HttpRouter.response(200, '<p>paragraph</p><a href="#/debug/sub">link</a>', 'text/html');
	},
	subhello:function() {
		return HttpRouter.response(200, 'link clicked!',/*<script class="program" src="/modules/pfraze/debug.js"></script>',*/ 'text/html');
	}
};
Agent.addServer('#/', server);

// client
addEventMsgListener('dom:request', function(e) {
	Agent.follow(e.request);
});
addEventMsgListener('dom:response', function(e) {
	Agent.dom.putNode({}, e.response.body, 'text/html');
	Agent.dom.listenEvent({ event:'click' });
	Agent.dom.listenEvent({ event:'click', selector:'p' });
	Agent.dom.listenEvent({ event:'click', selector:'a' });
});
addEventMsgListener('dom:click', function(e) {
	Agent.dom.postNode({}, '<p>body click!</p>', 'text/html');
});
addEventMsgListener('dom:click p', function(e) {
	Agent.dom.postNode({}, '<p>paragraph click!</p>', 'text/html');
});
addEventMsgListener('dom:click a', function(e) {
	Agent.dom.postNode({}, '<p>link click!</p>', 'text/html');
});

postEventMsg('ready');
