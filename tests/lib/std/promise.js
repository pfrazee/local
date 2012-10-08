// == SECTION Promise

var p1 = new Promise();
p1.then(print);
p1.then(function() { print('other cb'); });
p1.fulfill('fulfilled');
/* =>
fulfilled
other cb
*/
p1.fulfill('another value');
// =>
p1.then(function(v) { print('post-fulfill got '+v); });
// => post-fulfill got fulfilled
Promise.when('value', print);
// => value
Promise.when(p1, print);
// => fulfilled
var p2 = new Promise();
Promise.when(p2, print);
p2.fulfill('p2');
// => p2
var p3 = new Promise();
Promise.whenAll([p2,p3], print);
p3.fulfill('p3');
// => ['p2', 'p3']