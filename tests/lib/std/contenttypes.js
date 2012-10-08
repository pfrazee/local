// == SECTION ContentTypes

print(ContentTypes.serialize({ foo:'bar', a:5 }, 'application/json'));
// => {"foo":"bar","a":5}

print(ContentTypes.serialize({ foo:'bar', a:5, arr:[1,2,3] }, 'application/x-www-form-urlencoded'));
// => foo=bar&a=5&arr[]=1&arr[]=2&arr[]=3

print(ContentTypes.deserialize('{"foo":"bar","a":5}', 'application/json'));
// => {a: 5, foo: "bar"}

print(ContentTypes.deserialize('foo=bar&a=5&arr[]=1&arr[]=2&arr[]=3', 'application/x-www-form-urlencoded'));
// => {a: "5", arr: ["1", "2", "3"], foo: "bar"}