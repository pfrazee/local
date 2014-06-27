// get to parent frame

done = false;
startTime = Date.now();
web.get('#parent').then(printSuccess, printError).always(finishTest);
wait(function () { return done; });

/* =>
success
{
  ContentType: "text/plain",
  Link: [{href: "#parent", rel: "self service foo.com/baz", title: "Parent Frame"}],
  _buffer: "Top Window",
  body: "Top Window",
  links: [{href: "#parent", rel: "self service foo.com/baz", title: "Parent Frame"}],
  reason: undefined,
  status: 200
}
*/

// post to parent frame

done = false;
startTime = Date.now();
web.postText('#parent', 'ECHO PLZ').then(printSuccess, printError).always(finishTest);
wait(function () { return done; });

/* =>
success
{
  ContentType: "text/plain",
  Link: [{href: "#parent", rel: "self service foo.com/baz", title: "Parent Frame"}],
  _buffer: "echo plz",
  body: "echo plz",
  links: [{href: "#parent", rel: "self service foo.com/baz", title: "Parent Frame"}],
  reason: undefined,
  status: 200
}
*/