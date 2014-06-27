// get, resolve to current frame

done = false;
startTime = Date.now();
web.get({ rel: 'foo.com/bar' }).then(printSuccess, printError).always(finishTest);
wait(function () { return done; });

/* =>
success
{
  ContentType: "text/plain",
  Link: [{href: "#", rel: "self service foo.com/bar", title: "Page Root"}],
  _buffer: "Iframe server",
  body: "Iframe server",
  links: [{href: "#", rel: "self service foo.com/bar", title: "Page Root"}],
  reason: undefined,
  status: 200
}
*/

// post, resolve to current frame

done = false;
startTime = Date.now();
web.postText({ rel: 'foo.com/bar' }, 'echo plz').then(printSuccess, printError).always(finishTest);
wait(function () { return done; });

/* =>
success
{
  ContentType: "text/plain",
  Link: [{href: "#", rel: "self service foo.com/bar", title: "Page Root"}],
  _buffer: "ECHO PLZ",
  body: "ECHO PLZ",
  links: [{href: "#", rel: "self service foo.com/bar", title: "Page Root"}],
  reason: undefined,
  status: 200
}
*/

// get, resolve to parent frame

done = false;
startTime = Date.now();
web.get({ rel: 'foo.com/baz' }).then(printSuccess, printError).always(finishTest);
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

// post, resolve to parent frame

done = false;
startTime = Date.now();
web.postText({ rel: 'foo.com/baz' }, 'echo plz').then(printSuccess, printError).always(finishTest);
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