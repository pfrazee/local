
// temp worker ejection

local.maxActiveWorkers = 1; // force an ejection
done = false;
startTime = Date.now();
GET('./worker/worker3.js#').then(printSuccess,printError).always(finishTest);
wait(function () { return done; });

/* =>
success
{_buffer: "", body: "", links: [], reason: undefined, status: 204}
*/