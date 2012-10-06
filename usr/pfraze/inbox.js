if (!Agent.config.services) { Agent.config.services = []; }

// Server
// ======
var Server = {
	messages:[]
};
Server.routes = [
	Http.route('servMsg', { uri:'^/([0-9]+)/?$' }),
	Http.route('servMsgRange', { uri:'^/([0-9]+)-([0-9]+)/?$' }),
	Http.route('servAll', { uri:'^(/all)?/?$' }),
	Http.route('servChecked', { uri:'^/checked/?$' }),
	Http.route('servRead', { uri:'^/read/?' }),
	Http.route('servUnread', { uri:'^/unread/?' })
];
Server.runMethod = function(ids, request) {
	var f = request.method + 'Method';
	if (f in this) {
		return this[f](ids, request);
	} else {
		return Http.response(405);
	}
};
Server.makeRowSelector = function(ids, opt_more) {
	var selector = [];
	if (ids.length === 0) {
		return 'no ids provided'; // gambling that this selector wont hit
	}
	if (ids.length == this.messages.length) {
		return '.inbox tr' + (opt_more ? ' '+opt_more : ''); // a little more efficient
	}
	ids.forEach(function(id) { selector.push('.inbox tr:nth-child('+(id+1)+')' + (opt_more ? ' '+opt_more : '')); });
	return selector.join(', ');
};
// Resources
Server.servMsg = function(request, match) {
	var i = +match.uri[1] - 1;
	return this.runMethod([i], request);
};
Server.servMsgRange = function(request, match) {
	var low = +match.uri[1] - 1, high = +match.uri[2];
	var ids = [];
	for (var i=low; i < high; i++) {
		if (this.messages[i]) { ids.push(i); }
	}
	return this.runMethod(ids, request);
};
Server.servAll = function(request, match) {
	var ids = [];
	for (var i=0; i < this.messages.length; i++) {
		if (this.messages[i]) { ids.push(i); }
	}
	return this.runMethod(ids, request);
};
Server.servChecked = function(request) {
	var ids = [];
	this.messages.forEach(function(m, i) {
		if (m && m.checked) { ids.push(i); }
	});
	return this.runMethod(ids, request);
};
Server.servRead = function(request) {
	var ids = [];
	this.messages.forEach(function(m, i) {
		if (m && m.flags && m.flags.seen) { ids.push(i); }
	});
	return this.runMethod(ids, request);
};
Server.servUnread = function(request) {
	var ids = [];
	this.messages.forEach(function(m, i) {
		if (m && m.flags && !m.flags.seen) { ids.push(i); }
	});
	return this.runMethod(ids, request);
};
// Methods
Server.getMethod = function(ids, request) {
	if (ids.length > 1) {
		if (request.accept != 'application/json') {
			return { code:415, reason:'multiple messages can only be served in json' };
		}
		var messages = [];
		ids.forEach(function(id) {
			messages.push(this.messages[id]);
		}, this);
		return Http.response(200, { messages:messages }, 'application/json');
	}
	var m = this.messages[ids[0]];
	if (!m) { return { code:404 }; }
	// pipe to source service
	return Agent.dispatch({ method:'get', uri:m.uri, accept:request.accept });
};
Server.checkMethod = function(ids) {
	// if any are unchecked, we should check all
	var should_check = false;
	var m, i;
	for (i=0; i < ids.length; i++) {
		m = this.messages[ids[i]];
		if (!m.checked) {
			should_check = true;
			break;
		}
	}
	for (i=0; i < ids.length; i++) {
		this.messages[ids[i]].checked = should_check;
	}
	Agent.dom.putNode({ selectorAll:this.makeRowSelector(ids, '.msg-checkbox'), attr:'checked' }, should_check, 'text/plain');
	return Http.response([204, 'ok']);
};
Server.markreadMethod = function(ids) {
	if (ids.length === 0) { return Http.response([204,'ok']); }
	ids.forEach(function(id) {
		var m = this.messages[id];
		m.flags.seen = true;
		Agent.dispatch({ method:'put', uri:m.uri+'/flags', 'content-type':'application/json', body:{ seen:1 } });
	}, this);
	Agent.dom.postNode({ selectorAll:this.makeRowSelector(ids), attr:'class', remove:1 }, 'unread', 'text/plain');
	return Http.response([204, 'ok']);
};
Server.markunreadMethod = function(ids) {
	if (ids.length === 0) { return Http.response([204,'ok']); }
	ids.forEach(function(id) {
		var m = this.messages[id];
		m.flags.seen = false;
		Agent.dispatch({ method:'put', uri:m.uri+'/flags', 'content-type':'application/json', body:{ seen:0 } });
	}, this);
	Agent.dom.postNode({ selectorAll:this.makeRowSelector(ids), attr:'class', add:1 }, 'unread', 'text/plain');
	return Http.response([204, 'ok']);
};
Server.deleteMethod = function(ids) {
	if (ids.length === 0) { return Http.response([204,'ok']); }
	ids.forEach(function(id) {
		Agent.dispatch({ method:'delete', uri:this.messages[id].uri, accept:'application/json' });
		this.messages[id] = null;
		// :TODO: notify user of success?
	}, this);
	Agent.dom.putNode({ selectorAll:this.makeRowSelector(ids) }, '', 'text/html'); // dont delete so that our ids still match up to the dom node
	return Http.response(204);
};
Agent.addServer(Server);

// Client
// ======
// dispatch for messages
Agent.config.services.forEach(function(s) {
	Agent.dispatch({ method:'get', uri:s.uri, accept:'application/json' }).then(function(response) {
		if (response.code == 200) {
			s.messages = response.body.messages;
			for (var i=0; i < s.messages.length; i++) { s.messages[i].service = s.name; } // this kind of sucks
			Server.messages = Server.messages.concat(s.messages);
			render();
		}
	});
});

// event handlers
addEventMsgListener('dom:click .msg-checkbox', function(e) {
	var m = Server.messages[e.target_index];
	if (m) {
		m.checked = (m.checked) ? false : true;
	}
});
addEventMsgListener('dom:request', function(e) {
	Agent.dom.postAgent(0, { request:e.detail.request }, 'application/json');
});
addEventMsgListener('dom:request .inbox-toolbar', function(e) {
	Agent.dispatch(e.detail.request).then(Agent.renderResponse);
});

function render() {
	var html = '';

	Server.messages.sort(function(a,b) { return ((new Date(a.date).getTime() < new Date(b.date).getTime()) ? 1 : -1); });

	// styles
	html += '<style>';
	html += 'div.inbox-toolbar { height:35px }';
	html += 'div.inbox-toolbar .btn-group { display:inline-block }';
	html += 'table.inbox tr.unread a { color:black }';
	html += 'table.inbox tr a { color:gray }';
	html += '</style>';

	// toolbar
	html += '<div class="inbox-toolbar">';
	html += '<form action="'+Agent.getUri()+'/app/checked"><span class="btn-group">';
	html += '<button class="btn tool-select" title="check/uncheck" formmethod="check" formaction="'+Agent.getUri()+'/app/all" draggable="true"><i class="icon-check"></i></button>';
	html += '</span><span class="btn-group">';
	html += '<button class="btn tool-markread" title="mark as read" formmethod="markread" draggable="true"><i class="icon-eye-open"></i></button>';
	html += '<button class="btn tool-markunread" title="mark unread" formmethod="markunread" draggable="true"><i class="icon-eye-close"></i></button>';
	html += '<button class="btn tool-delete" title="delete" formmethod="delete" draggable="true"><i class="icon-trash" formmethod="delete"></i></button>';
	html += '</span></form>';
	html += '</div>';

	// composebar
	html += '<p> Compose: ';
	Agent.config.services.forEach(function(serv) {
		html += '<a href="'+serv.uri+'/new" title="compose message with '+serv.name+'" target="_blank"><span class="label label-info">'+serv.name+'</span></a> ';
	});
	html += '</p>';

	// messages
	html += '<table class="table table-condensed inbox">';
	Server.messages.forEach(function(m, i) {
		var date = new Date(m.date);
		var md = (date.getMonth()+1)+'/'+date.getDate()+'&nbsp;'+date.getHours()+':'+(date.getMinutes() < 10 ? '0' : '')+date.getMinutes();
		var trclass = (m.flags && !m.flags.seen ? 'unread' : '');
		html += '<tr class="'+trclass+'"><td style="color:gray">'+(i+1)+'</td><td><input class="msg-checkbox" type="checkbox" /></td><td><span class="label">'+m.service+'</span></td><td><a href="'+m.uri+'" target="_blank">'+m.summary+'</a></td><td><span style="color:gray">'+md+'</span></td></tr>';
	});
	html += '</table>';

	var ps = [];
	ps.push(Agent.dom.putNode({}, html, 'text/html'));

	// event listeners
	ps.push(Agent.dom.listenEvent({ event:'request', selector:'.inbox-toolbar' }));
	ps.push(Agent.dom.listenEvent({ event:'click', selector:'.msg-checkbox' }));
	return Promise.combine(ps);
}

Promise.whenAll([
	render(),
	Agent.dom.listenEvent({ event:'request' })
], function() {
	postEventMsg('ready');
});
