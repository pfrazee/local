// get to child frame

done = false;
startTime = Date.now();
web.get('#iframe').then(printSuccess, printError).always(finishTest);
wait(function () { return done; });

/* =>
success
{
  ContentType: "text/plain",
  Link: [{href: "#iframe", rel: "self service foo.com/bar", title: "Page Root"}],
  _buffer: "Iframe server",
  body: "Iframe server",
  links: [{href: "#iframe", rel: "self service foo.com/bar", title: "Page Root"}],
  reason: undefined,
  status: 200
}
*/

// post to child frame

done = false;
startTime = Date.now();
web.postText('#iframe', 'echo plz').then(printSuccess, printError).always(finishTest);
wait(function () { return done; });

/* =>
success
{
  ContentType: "text/plain",
  Link: [{href: "#iframe", rel: "self service foo.com/bar", title: "Page Root"}],
  _buffer: "ECHO PLZ",
  body: "ECHO PLZ",
  links: [{href: "#iframe", rel: "self service foo.com/bar", title: "Page Root"}],
  reason: undefined,
  status: 200
}
*/