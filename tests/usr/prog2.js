var Server = {
	message:''
};
Server.routes = [
	Http.route('msg', { method:'get', uri:'^/?$', accept:'text/plain' })
];
Server.msg = function() {
	return Http.response([200,'ok'], this.message, 'text/plain');
};
Agent.addServer(Server);

addEventMsgListener('dom:request', function(e) {
	Agent.dispatch(e.detail.request).then(function(res) {
		if (res.code == 403) { Server.message = 'forbidden'; }
		else { Server.message = res.body; }
	});
});

Promise.whenAll([
	Agent.dom.listenEvent({ event:'request' })
], function() {
	postEventMsg('ready');
});