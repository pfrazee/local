// == SECTION Http.Router
var s1 = {
	routes:[
		Http.route('a', { uri:'^/a/?$' }),
		Http.route('b_nores', { uri:'^/a/b/?$' }),
		Http.route('b_json', { uri:'^/a/b/?$', accept:'application/json' }),
		Http.route('b_html', { uri:'^/a/b/?$', accept:'text/html' })
	],
	a:function() { print('GET //s1/a'); return Http.response([200,'ok']); },
	b_nores:function() { print('nores'); },
	b_json:function() { print('GET //s1/a/b application/json'); return Http.response([200,'ok'], { foo:'bar' }, 'application/json'); },
	b_html:function() { print('GET //s1/a/b text/html'); return Http.response([200,'ok'], 'foobar', 'text/plain'); }
};

var r1 = new Http.Router();
r1.addServer('//s1', s1);
r1.dispatch({ method:'get', uri:'//s1/a' }).then(print);
wait();
/* =>
GET //s1/a
{code: 200, reason: 'ok'}
*/
r1.dispatch({ method:'get', uri:'//s1/a/b', accept:'application/json' }).then(print);
wait();
/* =>
nores
GET //s1/a/b application/json
{
  body: {foo: "bar"},
  code: 200,
  "content-type": "application/json",
  reason: "ok"
}
*/
r1.dispatch({ method:'get', uri:'//s1/a/b', accept:'text/html' }).then(print);
wait();
/* =>
nores
GET //s1/a/b text/html
{body: "foobar", code: 200, "content-type": "text/plain", reason: "ok"}
*/
r1.dispatch({ method:'get', uri:'http://linkshui.com:81/tests/foobar.txt' }).then(print);
wait();
/* =>
{
  ...
  body: "foobar",
  code: 200,
  ...
  "content-type": "text/plain",
  ...
  reason: "OK",
  ...
}
*/

// == SECTION Http.reflectLinks()
Agent.dispatch = Spy('Agent__dispatch');
var funcs = Http.reflectLinks({
	methods:['get','put','post','delete'],
	rel:'node',
	href:'lsh://dom.env/agent/{agent}/node?{selector}',
	type:'text/html'
});
print(funcs);
/* =>
{
	deleteNode: ...
	getNode: ...
	postNode: ...
	putNode: ...
}*/
funcs.getNode({ agent:'foo', selector:'bar' });
/* =>
function Agent(id, elem) {...}.Agent__dispatch({
  accept: "text/html",
  method: "get",
  uri: "lsh://dom.env/agent/foo/node?selector=\"bar\""
})
*/