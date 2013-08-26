
// test runner helpers

var done;
var startTime;
function printSuccess(res) {
  print('success');
  print(res);
  return res;
}
function printError(res) {
  print('error');
  print(res);
  throw res;
}
function finishTest() {
  console.log(Date.now() - startTime, 'ms');
  done = true;
}
function printSuccessAndFinish(res) { printSuccess(res); finishTest(); }
function printErrorAndFinish(err) { print('error'); print(err); finishTest(); }

// load worker
local.workerBootstrapUrl = '../worker.js';
local.spawnWorkerServer('test/worker/worker1.js');

// request/response test
done = false;
startTime = Date.now();
local.dispatch('worker1.js')
  .then(printSuccessAndFinish, printErrorAndFinish);
wait(function () { return done; });

/* =>
success
{
  body: {page: 0},
  headers: {"content-type": "application/json"},
  reason: "ok",
  status: 200
}
*/