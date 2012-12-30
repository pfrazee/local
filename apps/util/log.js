importScripts('/lib/linkjs-ext/responder.js');
importScripts('/lib/linkjs-ext/router.js');
importScripts('/lib/linkjs-ext/broadcaster.js');
importScripts('/lib/linkjs-ext/resource.js');

var uid = 1;
function genuid() { return uid++; }

var LogEntry = Link.resource({
	type:'item',
	methods:['get','delete'],
	defaultType:'text/html',
	attributes:{
		id:{ type:Number, value:genuid },
		label:{ type:String, fallback:null },
		content:{ type:String, required:true },
		createdAt:{ type:Date, value:null }
	},
	from:{
		json:function(request, obj) { return obj; },
		plain:function(request, string) { return { content:string }; },
		html:function(request, string) { return { content:string }; }
	},
	as:{
		html:function(request, entry) {
			var html = '<p>';
			if (entry.label) {
				html += '<strong>'+entry.label+'</strong> ';
			}
			return html+entry.content+'</p>';
		}
	}
});

var LogCollection = Link.resource({
	type:'collection',
	of:LogEntry,
	broadcast:true,
	methods:['get','post','delete'],
	defaultType:'text/html',
	filters:{
		since:function(items, timestamp) {
			var startTime = new Date(timestamp);
			return items.filter(function(item) { return (item.createdAt > startTime); });
		},
		before:function(items, timestamp) {
			var endTime = new Date(timestamp);
			return items.filter(function(item) { return (item.createdAt < endTime); });
		}
	},
	as:{
		html:function(request, entries) {
			var html = [
				'<h5>'+app.config.title+'</h5>',
				'<form action="httpl://'+app.config.domain+'"><output>',
				entries.map(function(e) { return LogEntry.model.as.html(null, e.values); }).reverse().join(''),
				'</output></form>'
			].join('');
			return html;
		}
	}
});

var logs = new LogCollection();
app.onHttpRequest(logs.route, logs);

app.postMessage('loaded');

/*
Prior to resource primitives, this was the definition:

importScripts('/lib/linkjs-ext/responder.js');
importScripts('/lib/linkjs-ext/router.js');
importScripts('/lib/linkjs-ext/broadcaster.js');

var log = [];
var logBroadcast = Link.broadcaster();

function renderHtml() {
	var html = [
		'<h5>'+app.config.title+'</h5>',
		'<form action="httpl://'+app.config.domain+'"><output>',
		log.map(function(entry) { return '<p>'+entry+'</p>'; }).reverse().join(''),
		'</output></form>'
	].join('');
	return html;
}

app.onHttpRequest(function(request, response) {
	var router = Link.router(request);
	var respond = Link.responder(response);

	router.mr('get', '/', function() {
		router.a('html', function() { respond.ok('html').end(renderHtml()); }); // respond with log html
		router.a('events', function() { respond.ok('events'); logBroadcast.addStream(response); }); // add the log updates listener
		router.error(response);
	});
	router.mrt('post', '/', /text\/[html|plain]/ig, function() {
		log.push(request.body); // store the entry
		logBroadcast.emit('update'); // tell our listeners about the change
		respond.ok().end(); // respond 200
	});
	router.error(response);
});
app.postMessage('loaded');
*/
