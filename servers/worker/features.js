var config = local.worker.config;

// live update list
var theList = [
	'bounded', 'civic', 'confined', 'district', 'divisional', 'geographical', 'insular', 'legendary',
	'limited', 'narrow', 'neighborhood', 'parish', 'parochial', 'provincial', 'regional', 'sectarian',
	'sectional', 'small-town', 'territorial', 'town', 'vernacular'
];
var theListFilter = '';
var listBroadcaster = local.http.ext.broadcaster();

// local storage nav
var localStorageCollection = local.http.ext.navigator('httpl://localstorage.env').collection('features-test');

// route handler
function main(request, response) {
	if (request.path == '/list') listResource(request, response);
	else if (request.path == '/env') envResource(request, response);
	else {
		// send back interface html
		response.writeHead(200, 'ok', {'content-type':'text/html'});
		response.end(makeDoc(request.path.slice(1), request));
	}
}

// routes
function listResource(request, response) {
	if (/get/i.test(request.method)) {
		if (/event-stream/.test(request.headers.accept)) {
			response.writeHead(200, 'ok', {'content-type':'text/event-stream'});
			listBroadcaster.addStream(response); // add stream to our broadcast
		} else {
			response.writeHead(200, 'ok', {'content-type':'text/html'});
			response.end(makeList(request));
		}
	} else if (/patch/i.test(request.method)) {
		// update the filter and trigger a GET
		theListFilter = request.body.filter;
		listBroadcaster.emit('update');
		response.writeHead(204, 'no content');
		response.end();
	} else {
		response.writeHead(405, 'request method not supported by that resource');
		response.end();
	}
}

function envResource(request, response) {
	local.promise(true)
		.succeed(function() {
			// pass post on to local storage
			if (/post/i.test(request.method)) {
				if (request.body['delete']) { // delete button?
					// delete the entry
					var targetId = request.body['delete'];
					return localStorageCollection.item(targetId).delete();
				} else {
					// add a new entry
					return localStorageCollection.post({});
				}
			}
			// get request, do nothing
			return true;
		})
		.succeed(function(res) {
			return localStorageCollection.getJson();
		})
		.succeed(function(res) {
			response.writeHead(200, 'ok', {'content-type':'text/html'});
			response.end(makeDoc('env', request, res.body));
		})
		.fail(function() {
			response.writeHead(502, 'bad gateway');
			response.end();
		});
}

// html builders
function makeNavLi(a, b, label) {
	return '<li{{active}}><a href="httpl://{{domain}}/{{path}}">{{label}}</a></li>'
		.replace('{{active}}', (a == b) ? ' class="active"' : '')
		.replace('{{domain}}', config.domain)
		.replace('{{path}}', b)
		.replace('{{label}}', label);
}

function makeNav(tab) {
	tab = tab || 'httpl';
	return '<ul class="nav nav-pills">{{1}}{{2}}{{3}}{{4}}</ul>'
		.replace('{{1}}', makeNavLi(tab,'httpl','HTTPL'))
		.replace('{{2}}', makeNavLi(tab,'app','Applications'))
		.replace('{{3}}', makeNavLi(tab,'env','The Page'))
		.replace('{{4}}', makeNavLi(tab,'more','Learn More'));
}

function makeFormItem(label, controls) {
	return (
		'<div class="control-group">' +
			'<label class="control-label">{{label}}</label>' +
			'<div class="controls">{{controls}}</div>' +
		'</div>'
		).replace('{{label}}', label)
		.replace('{{controls}}', controls);
}

function makeDoc(tab, request, content) {
	var html;
	var body = request.body || {};
	var isPost = /post/i.test(request.method);
	switch (tab) {
		case 'httpl':
		default:
			html = (
			'<p>Applications running in Web Workers respond to HTTPL requests from the page:</p>' +
			'<form action="httpl://'+config.domain+'/httpl" method="post" class="form-horizontal">' +
				'<legend>' +
					'Local ' +
					(isPost ? 'Response <small>from ' : 'Form <small>targets ') +
					'httpl://'+config.domain+'</small>'+
				'</legend>'+
				makeFormItem('Text input', isPost ? body.input : '<input type="text" name="input" class="input-xlarge">') +
				makeFormItem('Select', isPost ? body.select : (
					'<select name="select" class="input-xlarge">' +
						'<option value="A">A</option>' +
						'<option value="A">B</option>' +
					'</select>'
				)) +
				makeFormItem('Checkboxes', (isPost) ? (body.checks || []).join(', ') : (
					'<label class="checkbox inline"><input type="checkbox" name="checks" value="1"> 1</label>' +
					'<label class="checkbox inline"><input type="checkbox" name="checks" value="2"> 2</label>' +
					'<label class="checkbox inline"><input type="checkbox" name="checks" value="3"> 3</label>'
				)) +
				makeFormItem('Radios', isPost ? body.radios : (
					'<label class="radio inline"><input type="radio" value="1" checked="checked" name="radios"> 1</label>' +
					'<label class="radio inline"><input type="radio" value="2" name="radios"> 2</label>' +
					'<label class="radio inline"><input type="radio" value="3" name="radios"> 3</label>'
				)) +
				makeFormItem('Textarea', isPost ? body.textarea : '<div class="textarea"><textarea name="textarea"></textarea></div>') +
				makeFormItem('', isPost ?
					'<a class="btn" href="httpl://'+config.domain+'/httpl">Reset</a>' :
					'<input type="submit" class="btn" />'
				) +
			'</form>'
			);
			break;
		case 'app':
			html = (
				'<p>Server-Sent Events and added HTML behaviors allow applications to update the page in real-time:</p>' +
				'<legend>Realtime Updates</legend>' +
				'<form action="httpl://' + config.domain + '/list" onkeyup="patch">' +
					'<input type="text" name="filter" placeholder="Filter..." value="' + (request.query.filter||'') + '" /><br/>' +
					'<div data-subscribe="httpl://' + config.domain + '/list">' + makeList() + '</div>' +
				'</form>'
			);
			break;
		case 'env':
			html = (
				'<p>The Environment API controls applications and mediates traffic for security. '+
				'The page can also host servers in its namespace, so applications can access tools like localStorage:</p>'+
				'<form action="httpl://'+config.domain+'/env" method="post" class="form-horizontal">'+
					'<legend>LocalStorage Collections</legend>'+
					content.map(function(item) {
						return makeFormItem('Entry:', item.id + ' <button class="btn btn-mini btn-danger" name="delete" value="'+item.id+'"/>delete</button>');
					}).join('')+
					makeFormItem('', '<input type="submit" class="btn" value="Add Entry" />')+
				'</form>'+
				'<blockquote><small>Refresh the page to see the persistence in the browser\'s localStorage</small></blockquote>'
			);
			break;
		case 'more':
			html = (
				'<p>Learn more through the documentation and examples.</p>'+
				'<legend>Links</legend>'+
				'<ul>'+
					'<li><a target=_top href=docs.html title="Documentation">Documentation</a></li>'+
					'<li><a target=_top href=//blog.grimwire.com title="Development Blog">Development Blog</a></li>'+
					'<li><a target=_top href=//github.com/grimwire/local title="Github Repository">Github Repository</a></li>'+
					'<li><a target=_top href=//github.com/grimwire/local/issues title="Issue Tracker">Issue Tracker</a></li>'+
				'</ul>'
			);
			break;
	}
	return [
		makeNav(tab),
		html
	].join('');
}

function makeList(request) {
	return (
	'<ul class="unstyled">'+
		theList.filter(function(item) {
			return !theListFilter || item.indexOf(theListFilter) != -1;
		}).map(function(item) {
			return '<li>'+item+'</li>';
		}).join('')+
	'</ul>'
	);
}