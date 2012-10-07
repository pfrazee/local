addEventMsgListener('dom:request', function(e) {
	Agent.dispatch(e.detail.request).then(Agent.renderResponse);
});

setTimeout(function() {
	Agent.dispatch({ method:'get', uri:'lsh://inbox.ui/app/all', 'accept':'application/json' }).then(Agent.renderResponse);
}, 1000);

Promise.whenAll([
	Agent.dom.listenEvent({ event:'request' })
], function() {
	postEventMsg('ready');
});
