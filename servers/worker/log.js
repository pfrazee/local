var log = [];
var logBroadcast = local.http.ext.broadcaster();

function renderHtml(output) {
	var entriesHtml = log
		.map(function(entry) { return '<p>'+entry+'</p>'; })
		.reverse()
		.join('');
	if (output == 'entries') {
		return entriesHtml;
	}
	var html = [
		'<h5>'+local.worker.config.title+'</h5>',
		'<div data-subscribe="httpl://'+local.worker.config.domain+'?output=entries">',
			entriesHtml,
		'</div>'
	].join('');
	return html;
}

function main(request, response) {
	var router = local.http.ext.router(request);
	var respond = local.http.ext.responder(response);

	// collection
	router.p('/', function() {
		// build headers
		var headerer = local.http.ext.headerer();
		headerer.addLink('/', 'self current');

		// list
		router.m('HEAD', function() {
			respond.ok(null, headerer).end();
		});
		router.ma('GET', /html/, function() {
			respond.ok('html', headerer).end(renderHtml(request.query.output)); // respond with log html
		});
		// subscribe to events
		router.ma('GET', /event-stream/, function() {
			respond.ok('event-stream', headerer);
			logBroadcast.addStream(response); // add the log updates listener
			logBroadcast.emitTo(response, 'update'); // resync for any changes that might've occured
		});
		// add log entry
		router.mt('POST', /html|plain/, function() {
			log.push(request.body); // store the entry
			logBroadcast.emit('update'); // tell our listeners about the change
			respond.ok().end();
		});
		router.error(response, 'path');
	});
	router.error(response);
}
