// server
var server = {
	routes:[
		Http.route('hello', { uri:'^/?$', method:'get', accept:'text/html' }),
		Http.route('subhello', { uri:'^/sub$', method:'get', accept:'text/html' })
	],
	hello:function() {
		return Http.response(200, '<p><span>paragraph</span></p><a href="#/debug/sub">link</a><input type="checkbox" />', 'text/html');
	},
	subhello:function() {
		return Http.response(200, 'link clicked!<script class="program" src="/modules/pfraze/debug.js"></script>', 'text/html');
	}
};

// client
Agent.dom.listenEvent({ event:'request' });
addEventMsgListener('dom:request', function(e) {
    Agent.dispatch(e.request).then(Agent.renderResponse);
});

postEventMsg('ready');
