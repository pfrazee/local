// == SECTION helpers

// extractDocumentLinks

startTime = Date.now();
print(web.extractDocumentLinks(document, { links: true, anchors: true }));
finishTest();
/* =>
[
  {href: "doctest/.resources/doc.css", rel: "stylesheet", type: "text/css"},
  {href: "doctest/doctest.css", rel: "stylesheet", type: "text/css"},
  {href: "http://doctestjs.org", title: "doctest.js"}
]
*/


// httpHeaders

startTime = Date.now();

print(web.httpHeaders.deserialize('link', '</foo>; id="foo"; rel="what ever"'));
// => [{href: "/foo", id: "foo", rel: "what ever"}]
print(web.httpHeaders.serialize('link', [{href: "/foo", id: "foo", rel: "what ever"}]));
// => </foo>; id="foo"; rel="what ever"
print(web.httpHeaders.deserialize('link', '</foo>; id="foo"; rel="what ever", </bar>; id="bar"; rel="what ever"'));
/* =>
[
  {href: "/foo", id: "foo", rel: "what ever"},
  {href: "/bar", id: "bar", rel: "what ever"}
]
*/
print(web.httpHeaders.deserialize('link', '</foo>; id="foo"; rel="what, like, ever", </bar>; id="bar"; rel="what ever"'));
/* =>
[
  {href: "/foo", id: "foo", rel: "what, like, ever"},
  {href: "/bar", id: "bar", rel: "what ever"}
]
*/
print(web.httpHeaders.serialize('link', [
  {href: "/foo", id: "foo", rel: "what ever"},
  {href: "/bar", id: "bar", rel: "what ever"}
]));
// => </foo>; id="foo"; rel="what ever", </bar>; id="bar"; rel="what ever"
print(web.httpHeaders.deserialize('link', '</foo>; id=foo'));
// => [{href: "/foo", id: "foo"}]
print(web.httpHeaders.serialize('link', [{href: "/foo", id: "foo"}]));
// => </foo>; id="foo"
print(web.httpHeaders.deserialize('link', '</foo>; foobar; foobaz'));
// => [{foobar: true, foobaz: true, href: "/foo"}]
print(web.httpHeaders.serialize('link', [{foobar: true, foobaz: true, href: "/foo"}]));
// => </foo>; foobar; foobaz
print(web.httpHeaders.deserialize('link', '</foo{?bar,baz}>; id="foo"; rel="what ever"'));
// => [{href: "/foo{?bar,baz}", id: "foo", rel: "what ever"}]
print(web.httpHeaders.serialize('link', [{href: "/foo{?bar,baz}", id: "foo", rel: "what ever"}]));
// => </foo{?bar,baz}>; id="foo"; rel="what ever"

print(web.httpHeaders.deserialize('accept', 'text/html'));
// => [{full: "text/html", params: {}, q: 1, subtype: "html", type: "text"}]
print(web.httpHeaders.serialize('accept', [{full: "text/html", params: {}, q: 1, subtype: "html", type: "text"}]));
// => text/html
print(web.httpHeaders.deserialize('accept', 'text/html, text/plain'));
/* =>
[
  {full: "text/html", params: {}, q: 1, subtype: "html", type: "text"},
  {full: "text/plain", params: {}, q: 1, subtype: "plain", type: "text"}
]
*/
print(web.httpHeaders.serialize('accept', [
  {full: "text/html", params: {}, q: 1, subtype: "html", type: "text"},
  {full: "text/plain", params: {}, q: 1, subtype: "plain", type: "text"}
]));
// => text/html, text/plain
print(web.httpHeaders.deserialize('accept', 'text/html; q=0.5; foo=bar, application/json; q=0.2'));
/* =>
[
  {
    full: "text/html",
    params: {foo: "bar"},
    q: 0.5,
    subtype: "html",
    type: "text"
  },
  {
    full: "application/json",
    params: {},
    q: 0.2,
    subtype: "json",
    type: "application"
  }
]
*/
print(web.httpHeaders.serialize('accept', [
  {
    full: "text/html",
    params: {foo: "bar"},
    q: 0.5,
    subtype: "html",
    type: "text"
  },
  {
    full: "application/json",
    params: {},
    q: 0.2,
    subtype: "json",
    type: "application"
  }
]));
// => text/html; q=0.5; foo=bar, application/json; q=0.2
finishTest();


// queryLink(s)

startTime = Date.now();
var links = [
  { rel: 'foo service via', href: 'http://whatever.com', id: 'whatever', title: 'Whatever' },
  { rel: 'foo collection whatever.com/rel/collection', href: 'http://whatever.com/stuff', id: 'stuff', title: 'Whatever Stuff' },
  { rel: 'foo item http://whatever.com/rel/item other.com/-item', href: 'http://whatever.com/stuff/{id}', title: 'Whatever Item' },
  { rel: 'foo item other.com/-item', href: 'http://whatever.com/stuff/{id}{?q1}', title: 'Whatever Item', user: 'bob' },
];
print(web.queryLink(links[0], { rel: 'foo' }));
// => true
print(web.queryLink(links[0], 'foo'));
// => true
print(web.queryLink(links[0], { rel: 'foobar' }));
// => false
print(web.queryLink(links[0], 'foobar'));
// => false
print(web.queryLink(links[0], { rel: 'foo', id: 'bar' }));
// => false
print(web.queryLink(links[0], { rel: 'foo', title: 'Whatever' }));
// => true
print(web.queryLink(links[3], { rel: 'item other.com/-item', id: 'foobar', user: 'bob' }));
// => true

print(web.queryLinks(links, { rel: 'foo' }).length);
// => 4
print(web.queryLinks(links, { rel: 'foo service' }).length);
// => 1
print(web.queryLinks(links, { rel: 'whatever.com/rel/collection' }).length);
// => 1
print(web.queryLinks(links, { rel: 'http://whatever.com/rel/collection' }).length);
// => 0
print(web.queryLinks(links, { rel: 'foo', id: 'whatever' }).length);
// => 3
print(web.queryLinks(links, { rel: 'other.com/-item' }).length);
// => 2
print(web.queryLinks(links, { rel: '!foo' }).length);
// => 0
print(web.queryLinks(links, { rel: '!whatever.com/rel/collection' }).length);
// => 3
print(web.queryLinks(links, { rel: 'item !whatever.com/rel/collection' }).length);
// => 2
print(web.queryLinks(links, { rel: '!whatever.com/rel/collection item' }).length);
// => 2
print(web.queryLinks(links, { rel: 'other.com/-item', user: 'bob' }).length);
// => 1
print(web.queryLinks(links, { rel: 'other.com/-item', user: null }).length);
// => 1
print(web.queryLinks(links, { rel: 'other.com/-item', user: false }).length);
// => 1
print(web.queryLinks(links, { rel: 'other.com/-item', q1: true }).length);
// => 1
print(web.queryLinks(links, { rel: function(v, k) { return v == 'foo service via' && k == 'rel'; } }).length);
// => 1
print(web.queryLinks(links, { rel: /foo/, id: /^whatever$/ }).length);
// => 1
print(web.queryLinks(document, { rel: 'stylesheet' }).length);
// => 2

finishTest();


// preferredType(s)

startTime = Date.now();
print(web.preferredTypes('text/html, application/*;q=0.2, image/jpeg;q=0.8'));
// => ['text/html', 'application/*', 'image/jpeg']
print(web.preferredTypes('text/html, application/*;q=0.2, image/jpeg;q=0.8', ['text/html', 'text/plain', 'application/json']));
// => ['text/html', 'application/json']
print(web.preferredType('text/html, application/*;q=0.2, image/jpeg;q=0.8', ['text/html', 'text/plain', 'application/json']));
// => text/html
finishTest();


// joinRelPath

startTime = Date.now();
print(web.joinRelPath('http://grimwire.com', '/foo'));
// => http://grimwire.com/foo
print(web.joinRelPath('http://grimwire.com/bar', '/foo'));
// => http://grimwire.com/foo
print(web.joinRelPath('http://grimwire.com/bar', 'foo'));
// => http://grimwire.com/bar/foo
print(web.joinRelPath('http://grimwire.com/bar/bar', '../foo'));
// => http://grimwire.com/bar/foo
print(web.joinRelPath('http://grimwire.com/bar/bar', '../../foo'));
// => http://grimwire.com/foo
finishTest();


// parseNavUri

startTime = Date.now();
print(web.parseNavUri());
// => []
print(web.parseNavUri('nav:||'));
// => []
print(web.parseNavUri('nav:||http://foo.com'));
// => ["http://foo.com"]
print(web.parseNavUri('nav:||http://foo.com|bar'));
// => ["http://foo.com", {rel: "bar"}]
print(web.parseNavUri('||http://foo.com|bar'));
// => ["http://foo.com", {rel: "bar"}]
print(web.parseNavUri('|bar'));
// => [{rel: "bar"}]
print(web.parseNavUri('nav:||http://foo.com|bar=baz'));
// => ["http://foo.com", {id: "baz", rel: "bar"}]
print(web.parseNavUri('nav:||http://foo.com|bar+bum'));
// => ["http://foo.com", {rel: "bar bum"}]
print(web.parseNavUri('nav:||http://foo.com|bar+!bum'));
// => ["http://foo.com", {rel: "bar !bum"}]
print(web.parseNavUri('nav:||http://foo.com|bar+bum=baz'));
// => ["http://foo.com", {id: "baz", rel: "bar bum"}]
print(web.parseNavUri('nav:||http://foo.com|bar=baz,a=b'));
// => ["http://foo.com", {a: "b", id: "baz", rel: "bar"}]
print(web.parseNavUri('nav:||http://foo.com|bar=baz,a=b,c=f+g'));
// => ["http://foo.com", {a: "b", c: "f g", id: "baz", rel: "bar"}]
print(web.parseNavUri('nav:||http://foo.com|bar=baz,a=b,c=f%20g'));
// => ["http://foo.com", {a: "b", c: "f g", id: "baz", rel: "bar"}]
print(web.parseNavUri('nav:||http://foo.com|bar=baz|faa=feh'));
// => ["http://foo.com", {id: "baz", rel: "bar"}, {id: "feh", rel: "faa"}]
print(web.parseNavUri('nav:||http://foo.com|foo|foo|foo|foo|foo|foo|foo|foo|foo')); // limited to 5 navs
/* => [
  "http://foo.com",
  {rel: "foo"},
  {rel: "foo"},
  {rel: "foo"},
  {rel: "foo"},
  {rel: "foo"}
]*/
finishTest();


// renderUri
print(web.renderUri('http://foo.com/{baz}{?bar}', { baz: 'BAZ', bar: 'BAZAR' }));
// => http://foo.com/BAZ?bar=BAZAR


// escape
print(web.escape('<foo bar="baz">'));
// => &lt;foo bar=&quot;baz&quot;&gt;
