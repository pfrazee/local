// worker scaffold server
web.spawnWorker('/test/web/_worker.js');

web.export(main);
web.export(foo);
web.export(foo$);
web.export(events);

main.link(main, { rel: 'http://layer1.io/rel/test layer1.io/rel/test layer1.io' });
main.link(events, { rel: 'collection', id: 'events' });
main.link(foo, { rel: 'collection', id: 'foo' });
foo.link(foo$, { rel: 'item' });

main.ContentType('plain');
function main(req, res) {
    return 'service resource' + (((Object.keys(req.params).length > 0)) ? ' '+JSON.stringify(req.params) : '');
}

var foos = ['bar', 'baz', 'blah'];
foo.ContentType('json');
foo.opts({ stream: true });
function foo(req, res) {
	// so we can experiment with streaming, write the json in bits:
	res.status(200, 'Ok');
	res.write('[');
	foos.forEach(function(p, i) { res.write((i!==0?',':'')+'"'+p+'"'); });
	res.write(']');
	res.end();
}

foo.method(POST_foo);
POST_foo.opts({ stream: true });
function POST_foo(req, res) {
	// pipe back
	req.pipe(res.status(200));
}

foo$.ContentType('json');
function foo$(itemName, req, res) {
	var itemIndex = foos.indexOf(itemName);
	if (itemIndex === -1) {
		throw web.NotFound();
	}

    res.link(foo$.atId(foos[0]), { rel: 'first' });
    res.link(foo$.atId(foos[foos.length - 1]), { rel: 'last' });
	if (itemIndex !== 0) {
        res.link(foo$.atId('#foo/'+foos[itemIndex - 1]), { rel: 'prev' });
	}
	if (itemIndex !== foos.length - 1) {
		res.link(foo$.atId('#foo/'+foos[itemIndex + 1]), { rel: 'next' });
	}
	return  '"'+itemName+'"';
}

events.opts({ stream: true });
events.ContentType('events');
function events(req, res) {
	res.status(200);
	res.write({ event: 'foo', data: { c: 1 }});
	res.write({ event: 'foo', data: { c: 2 }});
	res.write({ event: 'bar', data: { c: 3 }});
	res.write('event: foo\r\n');
	setTimeout(function() { // break up the event to make sure the client waits for the whole thing
		res.write('data: { "c": 4 }\r\n\r\n');
		res.end({ event:'foo', data:{ c:5 }});
	}, 50);
}

web.export(headers_echo);
function headers_echo(req, res) {
	res.status(204)
		.header('content-type', req.ContentType)
		.header('fooBar', req.FooBar)
		.header('Asdf-fdsa', req.AsdfFdsa)
		.header('contentMD5', req.ContentMD5)
		.end();
}

web.export(mimetype_aliases_echo);
function mimetype_aliases_echo() {}
mimetype_aliases_echo.method(POST_mimetype_aliases_echo);
POST_mimetype_aliases_echo.Accept('text/csv');
POST_mimetype_aliases_echo.ContentType('html');
function POST_mimetype_aliases_echo(req, res) {
	return '<strong>'+req.body+'</strong>';
}

// body parsing
web.export(parse_body);
function parse_body() {}
parse_body.method(POST_parse_body);
function POST_parse_body(req, res) {
	if (req.ContentType !== 'application/json' && req.ContentType != web.contentTypes.lookup('form')) {
		throw web.UnsupportedMediaTypeError({ reason: 'only understands json and form-urlencoded' });
	}
	return req.body;
}

// query params
web.export(query_params);
query_params.ContentType('json');
function query_params(req, res) {
	return req.params;
}

web.export(timeout);
timeout.opts({ stream: true });
function timeout(req, res) {
	setTimeout(function() {
		res.status(204).end();
	}, 3000);
}

web.export(pipe);
pipe.opts({ stream: true });
function pipe(req, res) {
	var headerUpdate = function(k, v) {
		if (k == 'ContentType') { return 'text/piped+plain'; }
		return v;
	};
	var bodyUpdate = function(body) {
		return (req.params.toLower) ? body.toLowerCase() : body.toUpperCase();
	};
	if (req.method == 'GET')
		web.GET(req.params.src).pipe(res, headerUpdate, bodyUpdate);
}

pipe.method(POST_pipe);
pipe.opts({ stream: true });
function POST_pipe(req, res) {
	var headerUpdate = function(k, v) {
		if (k == 'ContentType') { return 'text/piped+plain'; }
		return v;
	};
	var bodyUpdate = function(body) {
		return (req.params.toLower) ? body.toLowerCase() : body.toUpperCase();
	};
	req.pipe(res.status(200, 'Ok'), headerUpdate, bodyUpdate);
}

// request links
web.export(req_links);
req_links.ContentType('json');
function req_links(req, res) {
	return req.links.get('item');
}