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