
// All access to our portion of the document is made by requests to the DOM server
// (if you're familiar with x-windows, the server/client relationship is similar)
// Agent.dom provides a function wrapper around the DOM server's API
var html = [];
html.push('<h2>'+Agent.config.message+'</h2>');
html.push('<p>LinkAP is a purely client-side application platform. It allows you to safely run programs<br/>');
html.push('together in the browser without involving a remote host.</p>');
html.push('<ul>');
html.push('<li>For more information, visit <a href="//linkapjs.com" title="linkapjs.com" target="_blank">linkapjs.com</a>.</li>');
html.push('<li>LinkAP is styled with <a href="//twitter.github.com/bootstrap/" title="Twitter Bootstrap" target="_blank">Twitter Bootstrap</a> and <a href="http://glyphicons.com/" title="Glyphicons" target="_blank">Glyphicons</a>.</li>');
html.push('<li>Find the most recent build at the <a href="//github.com/pfraze/link-ap" title="GitHub Repository" target="_blank">GitHub Repository</a>.</li>');
html.push('</ul>');
Agent.dom.putNode(0, html.join(''), 'text/html');

// Listen for any request events on our agent
addEventMsgListener('dom:request', function(e) {
	Agent.dispatch(e.detail.request).then(Agent.renderResponse);
});

// When ready, let the environment know our program has loaded
Promise.whenAll([
	// listenEvent creates a request to the dom server, and all requests are asyncronous
	// so to make sure we don't miss any requests sent to our agent, don't post ready till the listener is registered
	Agent.dom.listenEvent({ event:'request' })
], function() {
	postEventMsg('ready');
});