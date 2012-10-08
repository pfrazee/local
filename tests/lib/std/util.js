// == SECTION Util.deepCopy()
print(Util.deepCopy(5));
// => 5
print(Util.deepCopy('string'));
// => string
print(Util.deepCopy({ a:5, foo:'bar', fuz:{ baz:1000 } }));
// => {a: 5, foo: "bar", fuz: {baz: 1000}}
function Ctor() {
	this.foo = 'bar';
}
Ctor.prototype.speak = function() { return 'hello'; };
var inst = new Ctor();
var copy = Util.deepCopy(inst);
print(copy);
// => {foo: "bar", speak: function () {...}}
print(copy.speak());
// => hello