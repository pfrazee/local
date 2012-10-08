var Server = {
};
Server.routes = [
	Http.route('hw', { method:'get', uri:'^/?$', accept:'text/plain' }),
	Http.route('secret', { method:'get', uri:'^/secret/?$', accept:'text/plain' })
];
Server.hw = function() {
	return Http.response([200,'ok'], Agent.config.message, 'text/plain');
};
Server.secret = function(request) {
	if (request.authorization.perms.indexOf('foobar') == -1) {
		return Http.response.badperms('foobar');
	}
	return Http.response([200,'ok'], 'the secret', 'text/plain');
};
Agent.addServer(Server);

addEventMsgListener('dom:request', function(e) {
	Agent.dispatch(e.detail.request).then(Agent.renderResponse);
});

Agent.dom.putNode(0, 'Test sa-weeet', 'text/html');

Promise.whenAll([
	Agent.dom.listenEvent({ event:'request' })
], function() {
	postEventMsg('ready');
});