// == SECTION helpers

// pipe()

done = false;
startTime = Date.now();
var res = local.dispatch({ method:'get', url:'httpl://test.com/pipe' });
res.then(printSuccess, printError).then(finishTest);
wait(function () { return done; });

/* =>
success
{
  body: "SERVICE RESOURCE",
  headers: {
    "content-type": "text/piped+plain",
    link: [
      {
        href: "httpl://test.com/",
        rel: "self current http://grimwire.com/rel/test grimwire.com/rel/test grimwire.com"
      },
      {href: "httpl://test.com/events", id: "events", rel: "collection"},
      {href: "httpl://test.com/foo", id: "foo", rel: "collection"},
      {href: "httpl://test.com/{id}", rel: "collection"}
    ]
  },
  reason: "ok",
  status: 200
}
*/


// parseLinkHeader

startTime = Date.now();
print(local.parseLinkHeader('</foo>; id="foo"; rel="what ever"'));
// => [{href: "/foo", id: "foo", rel: "what ever"}]
print(local.parseLinkHeader('</foo>; id="foo"; rel="what ever", </bar>; id="bar"; rel="what ever"'));
/* =>
[
  {href: "/foo", id: "foo", rel: "what ever"},
  {href: "/bar", id: "bar", rel: "what ever"}
]
*/
print(local.parseLinkHeader('</foo>; id=foo'));
// => [{href: "/foo", id: "foo"}]
print(local.parseLinkHeader('</foo>; foobar; foobaz'));
// => [{foobar: true, foobaz: true, href: "/foo"}]
print(local.parseLinkHeader('</foo{?bar,baz}>; id="foo"; rel="what ever"'));
// => [{href: "/foo{?bar,baz}", id: "foo", rel: "what ever"}]
finishTest();


// queryLink(s)

startTime = Date.now();
var links = [
  { rel: 'foo service via', href: 'http://whatever.com', id: 'whatever', title: 'Whatever' },
  { rel: 'foo collection whatever.com/rel/collection', href: 'http://whatever.com/stuff', id: 'stuff', title: 'Whatever Stuff' },
  { rel: 'foo item http://whatever.com/rel/item other.com/-item', href: 'http://whatever.com/stuff/{id}', title: 'Whatever Item' },
  { rel: 'foo item other.com/-item', href: 'http://whatever.com/stuff/{id}', title: 'Whatever Item', user: 'bob' },
];
print(local.queryLink(links[0], { rel: 'foo' }));
// => true
print(local.queryLink(links[0], { rel: 'foobar' }));
// => false
print(local.queryLink(links[0], { rel: 'foo', id: 'bar' }));
// => false
print(local.queryLink(links[0], { rel: 'foo', title: 'Whatever' }));
// => true
print(local.queryLink(links[3], { rel: 'item other.com/-item', id: 'foobar', user: 'bob' }));
// => true
print(local.queryLinks(links, { rel: 'foo' }).length);
// => 4
print(local.queryLinks(links, { rel: 'foo service' }).length);
// => 1
print(local.queryLinks(links, { rel: 'whatever.com/rel/collection' }).length);
// => 1
print(local.queryLinks(links, { rel: 'http://whatever.com/rel/collection' }).length);
// => 0
print(local.queryLinks(links, { rel: 'foo', id: 'whatever' }).length);
// => 3
print(local.queryLinks(links, { rel: 'other.com/-item' }).length);
// => 2
print(local.queryLinks(links, { rel: '!foo' }).length);
// => 0
print(local.queryLinks(links, { rel: '!whatever.com/rel/collection' }).length);
// => 3
print(local.queryLinks(links, { rel: 'item !whatever.com/rel/collection' }).length);
// => 2
print(local.queryLinks(links, { rel: '!whatever.com/rel/collection item' }).length);
// => 2
print(local.queryLinks(links, { rel: 'other.com/-item', user: 'bob' }).length);
// => 1
finishTest();


// preferredType(s)

startTime = Date.now();
print(local.preferredTypes('text/html, application/*;q=0.2, image/jpeg;q=0.8'));
// => ['text/html', 'application/*', 'image/jpeg']
print(local.preferredTypes('text/html, application/*;q=0.2, image/jpeg;q=0.8', ['text/html', 'text/plain', 'application/json']));
// => ['text/html', 'application/json']
print(local.preferredType('text/html, application/*;q=0.2, image/jpeg;q=0.8', ['text/html', 'text/plain', 'application/json']));
// => text/html
finishTest();


// joinRelPath

startTime = Date.now();
print(local.joinRelPath('http://grimwire.com', '/foo'));
// => http://grimwire.com/foo
print(local.joinRelPath('http://grimwire.com/bar', '/foo'));
// => http://grimwire.com/foo
print(local.joinRelPath('http://grimwire.com/bar', 'foo'));
// => http://grimwire.com/bar/foo
print(local.joinRelPath('http://grimwire.com/bar/bar', '../foo'));
// => http://grimwire.com/bar/foo
print(local.joinRelPath('http://grimwire.com/bar/bar', '../../foo'));
// => http://grimwire.com/foo
finishTest();


// parseNavUri

startTime = Date.now();
print(local.parseNavUri());
// => []
print(local.parseNavUri('nav:||'));
// => []
print(local.parseNavUri('nav:||http://foo.com'));
// => ["http://foo.com"]
print(local.parseNavUri('nav:||http://foo.com|bar'));
// => ["http://foo.com", {rel: "bar"}]
print(local.parseNavUri('||http://foo.com|bar'));
// => ["http://foo.com", {rel: "bar"}]
print(local.parseNavUri('|bar'));
// => [{rel: "bar"}]
print(local.parseNavUri('nav:||http://foo.com|bar=baz'));
// => ["http://foo.com", {id: "baz", rel: "bar"}]
print(local.parseNavUri('nav:||http://foo.com|bar+bum'));
// => ["http://foo.com", {rel: "bar bum"}]
print(local.parseNavUri('nav:||http://foo.com|bar+!bum'));
// => ["http://foo.com", {rel: "bar !bum"}]
print(local.parseNavUri('nav:||http://foo.com|bar+bum=baz'));
// => ["http://foo.com", {id: "baz", rel: "bar bum"}]
print(local.parseNavUri('nav:||http://foo.com|bar=baz,a=b'));
// => ["http://foo.com", {a: "b", id: "baz", rel: "bar"}]
print(local.parseNavUri('nav:||http://foo.com|bar=baz,a=b,c=f+g'));
// => ["http://foo.com", {a: "b", c: "f g", id: "baz", rel: "bar"}]
print(local.parseNavUri('nav:||http://foo.com|bar=baz,a=b,c=f%20g'));
// => ["http://foo.com", {a: "b", c: "f g", id: "baz", rel: "bar"}]
print(local.parseNavUri('nav:||http://foo.com|bar=baz|faa=feh'));
// => ["http://foo.com", {id: "baz", rel: "bar"}, {id: "feh", rel: "faa"}]
finishTest();


// hosts service

done = false;
startTime = Date.now();
local.dispatch({ method: 'HEAD', url: 'httpl://hosts' })
  .then(printSuccessAndFinish, printErrorAndFinish);
wait(function () { return done; });

/* =>
success
{
  body: "",
  headers: {
    link: [
      {href: "httpl://hosts/", id: "hosts", rel: "self service via"},
      {href: "httpl://_worker.js/", rel: "current"},
      {
        href: "httpl://test.com/",
        rel: "current http://grimwire.com/rel/test grimwire.com/rel/test grimwire.com"
      }
    ]
  },
  reason: "ok, no content",
  status: 204
}
*/