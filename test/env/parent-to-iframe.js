// get to child frame

done = false;
startTime = Date.now();
web.get('local://iframe').then(printSuccess, printError).always(finishTest);
wait(function () { return done; });

/* =>
success
{
  ContentType: "text/plain",
  Link: [{href: "local://iframe/", rel: "self service foo.com/bar", title: "Page Root"}],
  _buffer: "Iframe server",
  body: "Iframe server",
  links: [{href: "local://iframe/", rel: "self service foo.com/bar", title: "Page Root"}],
  reason: undefined,
  status: 200
}
*/

// post to child frame

done = false;
startTime = Date.now();
web.postText('local://iframe', 'echo plz').then(printSuccess, printError).always(finishTest);
wait(function () { return done; });

/* =>
success
{
  ContentType: "text/plain",
  Link: [{href: "local://iframe/", rel: "self service foo.com/bar", title: "Page Root"}],
  _buffer: "ECHO PLZ",
  body: "ECHO PLZ",
  links: [{href: "local://iframe/", rel: "self service foo.com/bar", title: "Page Root"}],
  reason: undefined,
  status: 200
}
*/