// get, resolve to current frame

done = false;
startTime = Date.now();
web.get({ rel: 'foo.com/bar' }).then(printSuccess, printError).always(finishTest);
wait(function () { return done; });

/* =>
success
{
  ContentType: "text/plain",
  _buffer: "Iframe server",
  body: "Iframe server",
  links: [],
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
  _buffer: "ECHO PLZ",
  body: "ECHO PLZ",
  links: [],
  reason: undefined,
  status: 200
}
*/