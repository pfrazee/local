// temp worker ejection

web.cfg.maxActiveWorkers = 1; // force an ejection
done = false;
startTime = Date.now();
web.get('./worker/worker3.js#').then(printSuccess,printError).always(finishTest);
wait(function () { return done; });

/* =>
success
{_buffer: "", body: "", links: [], reason: undefined, status: 204}
*/

// // temp worker ejection

// web.cfg.maxActiveWorkers = 1; // force an ejection
// done = false;
// startTime = Date.now();
// web.GET('./worker/worker3.js#').then(printSuccess,printError).always(finishTest);
// wait(function () { return done; });

// /* =>
// success
// {_buffer: "", body: "", links: [], reason: "No Content", status: 204}
// */