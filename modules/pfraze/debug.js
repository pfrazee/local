// server
var server = {
	routes:[
		HttpRouter.route('hello', { uri:'^/?$', method:'get', accept:'text/html' }),
		HttpRouter.route('subhello', { uri:'^/sub$', method:'get', accept:'text/html' })
	],
	hello:function() {
		return HttpRouter.response(200, '<p><span>paragraph</span></p><a href="#/debug/sub">link</a><input type="checkbox" />', 'text/html');
	},
	subhello:function() {
		return HttpRouter.response(200, 'link clicked!<script class="program" src="/modules/pfraze/debug.js"></script>', 'text/html');
	}
};

// client
addEventMsgListener('dom:request', function(e) {
	Agent.follow(e.request);
});
addEventMsgListener('dom:response', function(e) {
	Agent.dom.putNode({}, e.response.body, 'text/html');
});

Agent.dom.listenEvent({ event:'click' });
Agent.dom.listenEvent({ event:'click', selector:'p span' });
Agent.dom.listenEvent({ event:'click', selector:'span' });
addEventMsgListener('dom:click', function(e) {
	Agent.dom.postNode({}, '<p>body click!</p>', 'text/html');
	Agent.dom.unlistenEvent({ event:'click' });
});
addEventMsgListener('dom:click p span', function(e) {
	Agent.dom.postNode({}, '<p>p span click!</p>', 'text/html');
});
addEventMsgListener('dom:click span', function(e) {
	Agent.dom.postNode({}, '<p>span click!</p>', 'text/html');
});

postEventMsg('ready');
