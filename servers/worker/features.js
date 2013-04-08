importScripts('linkjs-ext/responder.js');
importScripts('linkjs-ext/router.js');
importScripts('linkjs-ext/broadcaster.js');

// live update list
var theList = [
	'bounded', 'civic', 'confined', 'district', 'divisional', 'geographical', 'insular', 'legendary',
	'limited', 'narrow', 'neighborhood', 'parish', 'parochial', 'provincial', 'regional', 'sectarian',
	'sectional', 'small-town', 'territorial', 'town', 'vernacular'
];

function FeaturesServer() {
	this.theListFilter = '';
	this.listBroadcaster = Link.broadcaster();

	this.lsCollection = Link.navigator('httpl://localstorage.env').collection('features-test');
}
FeaturesServer.prototype = Object.create(localApp.Server.prototype);

FeaturesServer.prototype.handleHttpRequest = function(request, response) {
	var router = Link.router(request);
	var respond = Link.responder(response);
	var self = this;

	router.mp(/GET/i, '/list', function() {
		router.a(/event\-stream/, function() {
			// add stream to our broadcast
			respond.ok('text/event-stream');
			self.listBroadcaster.addStream(response);
		});
		router.a(/html/, function() {
			// send back list html
			respond.ok('html').end(self.makeList(request));
		});
		router.error(response, ['method','path']);
	});

	router.mp(/PATCH/i, '/list', function() {
		// update the filter and trigger a GET
		self.theListFilter = request.body.filter;
		self.listBroadcaster.emit('update');
		respond.noContent().end();
	});

	router.mp(/GET|POST/i, '/env', function() {
		var p = Local.promise(true);
		// pass post on to local storage
		if (/POST/i.test(request.method)) {
			if (request.body['delete']) { // delete button?
				// delete the entry
				var targetId = request.body['delete'];
				p = self.lsCollection.item(targetId).delete();
			} else {
				// add a new entry
				p = self.lsCollection.post({});
			}
			p.fail(respond.cb('badGateway'));
		}
		// get data and send back interface html
		p.succeed(function(res) {
			self.lsCollection.getJson()
				.succeed(function(res) {
					respond.ok('html').end(self.makeDoc('env', request, res.body));
					return res;
				})
				.fail(respond.cb('badGateway'));
			return res;
		});
	});

	router.mp(/GET|POST/i, RegExp('^/([a-z\\-]*)/?$'), function(match) {
		// send back interface html
		respond.ok('html').end(self.makeDoc(match.path[1], request));
	});
	router.error(response);
};

// html builders
FeaturesServer.prototype.makeNavLi = function(a, b, label) {
	return [
		(a == b) ? '<li class="active">' : '<li>',
		'<a href="httpl://'+this.config.domain, '/', b, '">', label, '</a></li>'
	].join('');
};

FeaturesServer.prototype.makeNav = function(tab) {
	tab = tab || 'httpl';
	return [
		'<ul class="nav nav-pills">',
			this.makeNavLi(tab,'httpl','HTTPL'),
			this.makeNavLi(tab,'app','Applications'),
			this.makeNavLi(tab,'env','The Page'),
			this.makeNavLi(tab,'more','Learn More'),
		'</ul>'
	].join('');
};

FeaturesServer.prototype.makeFormItem = function(label, controls) {
	return [
		'<div class="control-group">',
			'<label class="control-label">',label,'</label>',
			'<div class="controls">', controls, '</div>',
		'</div>'
	].join('');
};

FeaturesServer.prototype.makeDoc = function(tab, request, content) {
	var html, self = this;
	var body = request.body || {};
	var isPost = /post/i.test(request.method);
	switch (tab) {
		case 'httpl':
		default:
			html = [
				'<p>Applications running in Web Workers respond to HTTPL requests from the page:</p>',
				'<form action="httpl://', this.config.domain, '/httpl" method="post" class="form-horizontal">',
					'<legend>',
						'Local ',
						isPost ? 'Response <small>from ' : 'Form <small>targets ',
						'httpl://', this.config.domain, '</small>',
					'</legend>',
					this.makeFormItem('Text input', isPost ? body.input : '<input type="text" name="input" class="input-xlarge">'),
					this.makeFormItem('Select', isPost ? body.select : [
						'<select name="select" class="input-xlarge">',
							'<option value="A">A</option>',
							'<option value="A">B</option>',
						'</select>'
					].join('')),
					this.makeFormItem('Checkboxes', (isPost) ? (body.checks || []).join(', ') : [
						'<label class="checkbox inline"><input type="checkbox" name="checks" value="1"> 1</label>',
						'<label class="checkbox inline"><input type="checkbox" name="checks" value="2"> 2</label>',
						'<label class="checkbox inline"><input type="checkbox" name="checks" value="3"> 3</label>'
					].join('')),
					this.makeFormItem('Radios', isPost ? body.radios : [
						'<label class="radio inline"><input type="radio" value="1" checked="checked" name="radios"> 1</label>',
						'<label class="radio inline"><input type="radio" value="2" name="radios"> 2</label>',
						'<label class="radio inline"><input type="radio" value="3" name="radios"> 3</label>'
					].join('')),
					this.makeFormItem('Textarea', isPost ? body.textarea : '<div class="textarea"><textarea name="textarea"></textarea></div>'),
					this.makeFormItem('', isPost ?
						'<a class="btn" href="httpl://'+this.config.domain+'/httpl">Reset</a>' :
						'<input type="submit" class="btn" />'
					),
				'</form>'
			].join('');
			break;
		case 'app':
			html = [
				'<p>Server-Sent Events and added HTML behaviors allow applications to update the page in real-time:</p>',
				'<legend>Realtime Updates</legend>',
				'<form action="httpl://', this.config.domain, '/list" onkeyup="patch">',
					'<input type="text" name="filter" placeholder="Filter..." value="', request.query.filter ,'" /><br/>',
					'<output name="list">', this.makeList() ,'</output>',
				'</form>'
			].join('');
			break;
		case 'env':
			html = [
				'<p>The Environment API controls applications and mediates traffic for security. ',
				'The page can also host servers in its namespace, so applications can access tools like localStorage:</p>',
				'<form action="httpl://', this.config.domain, '/env" method="post" class="form-horizontal">',
					'<legend>LocalStorage Collections</legend>',
					content.map(function(item) {
						return self.makeFormItem('Entry:', item.id + ' <button class="btn btn-mini btn-danger" name="delete" value="'+item.id+'"/>delete</button>');
					}).join(''),
					this.makeFormItem('', '<input type="submit" class="btn" value="Add Entry" />'),
				'</form>',
				'<blockquote><small>Refresh the page to see the persistence in the browser\'s localStorage</small></blockquote>'
			].join('');
			break;
		case 'more':
			html = [
				'<p>Learn more through the documentation and examples.</p>',
				'<legend>Links</legend>',
				'<ul>',
					'<li><a target=_top href=docs.html title="Documentation">Documentation</a></li>',
					'<li><a target=_top href=//blog.grimwire.com title="Development Blog">Development Blog</a></li>',
					'<li><a target=_top href=//github.com/grimwire/local title="Github Repository">Github Repository</a></li>',
					'<li><a target=_top href=//github.com/grimwire/local/issues title="Issue Tracker">Issue Tracker</a></li>',
				'</ul>'
			].join('');
			break;
	}
	return [
		this.makeNav(tab),
		html
	].join('');
};

FeaturesServer.prototype.makeList = function(request) {
	var self = this;
	return [
		'<ul class="unstyled">',
		theList
			.filter(function(item) {
				return !self.theListFilter || item.indexOf(self.theListFilter) != -1;
			})
			.map(function(item) {
				return '<li>'+item+'</li>';
			})
			.join(''),
		'</ul>'
	].join('');
};

localApp.setServer(FeaturesServer);