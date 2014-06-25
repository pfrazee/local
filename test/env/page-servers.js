// document server

done = false;
startTime = Date.now();
web.get('#localjs/document').then(printSuccess, printError).always(finishTest);
wait(function () { return done; });

/* =>
success
{
  Link: [
    {href: "../doctest/.resources/doc.css", rel: "stylesheet", type: "text/css"},
    {href: "../doctest/doctest.css", rel: "stylesheet", type: "text/css"},
    {href: "#", rel: "service foo.com/bar", title: "Page Root"}
  ],
  _buffer: "",
  body: "",
  links: [
    {href: "../doctest/.resources/doc.css", rel: "stylesheet", type: "text/css"},
    {href: "../doctest/doctest.css", rel: "stylesheet", type: "text/css"},
    {href: "#", rel: "service foo.com/bar", title: "Page Root"}
  ],
  reason: "Ok, no content",
  status: 204
}
*/

// window.parent server

done = false;
startTime = Date.now();
web.get('#localjs/window.parent').then(printSuccess, printError).always(finishTest);
wait(function () { return done; });

/* =>
success
{
  Link: [
    {href: "../doctest/.resources/doc.css", rel: "stylesheet", type: "text/css"},
    {href: "../doctest/doctest.css", rel: "stylesheet", type: "text/css"},
    {href: "#", rel: "service foo.com/bar", title: "Page Root"}
  ],
  _buffer: "",
  body: "",
  links: [
    {href: "../doctest/.resources/doc.css", rel: "stylesheet", type: "text/css"},
    {href: "../doctest/doctest.css", rel: "stylesheet", type: "text/css"},
    {href: "#", rel: "service foo.com/bar", title: "Page Root"}
  ],
  reason: "Ok, no content",
  status: 204
}
*/

// window.opener server

done = false;
startTime = Date.now();
web.get('#localjs/window.opener').then(printSuccess, printError).always(finishTest);
wait(function () { return done; });

/* =>
error
{
  _buffer: "",
  body: "",
  links: [],
  reason: "No opener frame detected",
  status: 404
}
*/

// window.location.origin server

done = false;
startTime = Date.now();
web.get('#localjs/window.location.origin')
	.then(function(res) { print(res.status); print(res.reason); }, printError)
	.always(finishTest);
wait(function () { return done; });

/* =>
200
OK
*/

// union environment server

done = false;
startTime = Date.now();
web.get('#localjs/env').then(printSuccess, printError).always(finishTest);
wait(function () { return done; });

/* =>
success
{
  Link: [
    {href: "../doctest/.resources/doc.css", rel: "stylesheet", type: "text/css"},
    {href: "../doctest/doctest.css", rel: "stylesheet", type: "text/css"},
    {href: "#", rel: "service foo.com/bar", title: "Page Root"}
  ],
  _buffer: "",
  body: "",
  links: [
    {href: "../doctest/.resources/doc.css", rel: "stylesheet", type: "text/css"},
    {href: "../doctest/doctest.css", rel: "stylesheet", type: "text/css"},
    {href: "#", rel: "service foo.com/bar", title: "Page Root"}
  ],
  reason: "Ok, no content",
  status: 204
}
*/