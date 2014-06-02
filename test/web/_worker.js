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

var foos = ['bar', 'bazzzz', 'blah'];
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

	res.link([
		{ href: foo$.atId(foos[0]), rel: 'first' },
		{ href: foo$.atId(foos[foos.length - 1]), rel: 'last' }
	]);
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
	web.GET('#').pipe(res, headerUpdate, bodyUpdate);
}